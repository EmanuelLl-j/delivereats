import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { OrderStatus, PaymentProvider, PaymentStatus } from '../generated/prisma';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { EventPublisher, requireOwnedFile } from '@delivereats/backend-kit';
import { PrismaService } from '../prisma.service';

const supported = ['CASH', 'MERCADO_PAGO', 'YAPE_MANUAL', 'PLIN_MANUAL'];
export function verifyWebhookSignature(id: string, requestId: string, signature: string, secret: string, now = Date.now()) {
  const fields = Object.fromEntries(signature.split(',').map(part => part.trim().split('=')));
  if (!id || !requestId || !secret || !/^\d{10,13}$/.test(fields.ts ?? '') || !/^[a-f0-9]{64}$/i.test(fields.v1 ?? '')) return false;
  const timestamp = Number(fields.ts) * (fields.ts.length <= 10 ? 1000 : 1);
  if (Math.abs(now - timestamp) > 5 * 60_000) return false;
  const expected = createHmac('sha256', secret).update(`id:${id.toLowerCase()};request-id:${requestId};ts:${fields.ts};`).digest();
  return timingSafeEqual(expected, Buffer.from(fields.v1, 'hex'));
}

@Injectable()
export class PaymentService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventPublisher) {}

  private client() {
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) throw new ServiceUnavailableException('Mercado Pago no configurado');
    return new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN, options: { timeout: 8_000 } });
  }

  async assertConfigured(method: string) {
    if (!supported.includes(method)) throw new BadRequestException('Selecciona un medio de pago vigente');
    const config = await this.prisma.paymentConfiguration.findUnique({ where: { method } });
    if (!config?.enabled) throw new ServiceUnavailableException('Este medio de pago está deshabilitado');
    if (method.endsWith('_MANUAL') && (!config.accountLabel || !config.instructions || !config.qrImageUrl)) throw new ServiceUnavailableException('Falta configurar la cuenta y QR de pago');
    if (method === 'MERCADO_PAGO') {
      this.client();
      if (!process.env.MERCADOPAGO_WEBHOOK_SECRET || !process.env.PUBLIC_API_URL?.startsWith('https://') || !process.env.WEB_URL?.startsWith('https://')) throw new ServiceUnavailableException('Mercado Pago requiere webhook firmado y URLs HTTPS');
    }
    return config;
  }

  async methods() {
    const configs = await this.prisma.paymentConfiguration.findMany({ where: { enabled: true } });
    const result = [];
    for (const config of configs) { try { await this.assertConfigured(config.method); result.push(config); } catch { /* An unconfigured provider is not offered to the customer. */ } }
    return result;
  }

  async createForOrder(orderId: string, correlationId?: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if ([OrderStatus.CANCELLED, OrderStatus.REQUIRES_REVIEW, OrderStatus.DELIVERED].includes(order.status as never)) throw new ConflictException('El pedido no admite iniciar un pago');
    const config = await this.assertConfigured(order.paymentMethod);
    const intent = await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${orderId}))`;
      const existing = await tx.paymentIntent.findFirst({ where: { orderId, status: { notIn: ['CANCELLED', 'REFUNDED'] } }, orderBy: { createdAt: 'desc' } });
      return existing ?? tx.paymentIntent.create({ data: { orderId, method: order.paymentMethod, amount: order.total, provider: order.paymentMethod === 'CASH' ? 'CASH' : order.paymentMethod === 'MERCADO_PAGO' ? 'MERCADO_PAGO' : 'MANUAL' } });
    });
    if (intent.provider === PaymentProvider.MERCADO_PAGO && !intent.externalId) {
      const preference = await new Preference(this.client()).create({
        body: { items: [{ id: order.id, title: `Pedido ${order.orderNumber}`, quantity: 1, unit_price: Number(order.total), currency_id: 'PEN' }],
          external_reference: intent.id, notification_url: `${process.env.PUBLIC_API_URL}/payments/webhook/mercadopago`,
          back_urls: { success: `${process.env.WEB_URL}/pago/exito`, failure: `${process.env.WEB_URL}/pago/error`, pending: `${process.env.WEB_URL}/pago/pendiente` }, auto_return: 'approved' },
        requestOptions: { idempotencyKey: intent.id },
      });
      if (!preference.id || !preference.init_point) throw new ServiceUnavailableException('Mercado Pago no devolvió una preferencia válida');
      const saved = await this.prisma.paymentIntent.update({ where: { id: intent.id }, data: { externalId: preference.id, providerReference: preference.init_point } });
      await this.events.publish('payment.created', { paymentIntentId: saved.id, orderId, customerId: order.customerId }, correlationId);
      return { ...saved, client: { checkoutUrl: saved.providerReference } };
    }
    return { ...intent, client: { checkoutUrl: intent.providerReference, accountLabel: config.accountLabel, instructions: config.instructions, qrImageUrl: config.qrImageUrl, cashOnDelivery: order.paymentMethod === 'CASH' } };
  }

  async get(intentId: string, userId: string, isAdmin: boolean) {
    const intent = await this.prisma.paymentIntent.findUnique({ where: { id: intentId }, include: { order: true } });
    if (!intent) throw new NotFoundException('Pago no encontrado');
    if (!isAdmin && intent.order.customerId !== userId) throw new ForbiddenException('No puedes consultar este pago');
    return intent;
  }

  async retryOwn(orderId: string, userId: string) {
    if (!await this.prisma.order.findFirst({ where: { id: orderId, customerId: userId } })) throw new ForbiddenException('Pedido no disponible');
    return this.createForOrder(orderId);
  }

  async evidence(intentId: string, customerId: string, dto: { operationCode: string; evidenceFileId: string }) {
    await requireOwnedFile(customerId, dto.evidenceFileId, ['PAYMENT_EVIDENCE']);
    const intent = await this.get(intentId, customerId, false);
    if (intent.provider !== 'MANUAL' || !['PENDING', 'REJECTED'].includes(intent.status) || intent.order.status !== 'PENDING') throw new ConflictException('Este pago no admite comprobantes');
    return this.prisma.$transaction(async tx => {
      const operationKey = `${intent.method}:${dto.operationCode}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${operationKey}))`;
      const duplicate = await tx.paymentIntent.findFirst({ where: { method: intent.method, operationCode: dto.operationCode, id: { not: intent.id } } });
      if (duplicate) throw new ConflictException('El código de operación ya está registrado');
      const claimed = await tx.paymentIntent.updateMany({ where: { id: intentId, status: intent.status }, data: { ...dto, status: 'PAYMENT_PENDING_VERIFICATION', reviewReason: null } });
      if (!claimed.count) throw new ConflictException('El pago cambió; vuelve a cargarlo');
      await tx.order.update({ where: { id: intent.orderId }, data: { paymentStatus: 'PAYMENT_PENDING_VERIFICATION' } });
      await tx.auditLog.create({ data: { actorUserId: customerId, action: 'PAYMENT_EVIDENCE_SUBMITTED', entity: 'PaymentIntent', entityId: intentId } });
      return tx.paymentIntent.findUniqueOrThrow({ where: { id: intentId } });
    });
  }

  async review(intentId: string, adminId: string, approved: boolean, reason: string) {
    const intent = await this.get(intentId, adminId, true);
    if (intent.provider !== 'MANUAL' || intent.status !== 'PAYMENT_PENDING_VERIFICATION' || !intent.operationCode || !intent.evidenceFileId) throw new ConflictException('El pago no espera verificación manual');
    if (intent.order.customerId === adminId) throw new ForbiddenException('No puedes verificar tu propio pago');
    return this.applyVerifiedStatus(intent.id, approved ? PaymentStatus.APPROVED : PaymentStatus.REJECTED, undefined, { adminId, reason, expected: 'PAYMENT_PENDING_VERIFICATION' });
  }

  async verifyMercadoPago(paymentId: string, requestId: string, signature: string, correlationId?: string) {
    if (!verifyWebhookSignature(paymentId, requestId, signature, process.env.MERCADOPAGO_WEBHOOK_SECRET ?? '')) throw new ForbiddenException('Firma de webhook inválida o vencida');
    const payment = await new Payment(this.client()).get({ id: paymentId });
    if (!payment.external_reference || String(payment.id) !== paymentId) throw new BadRequestException('Referencia de pago inválida');
    const intent = await this.prisma.paymentIntent.findUnique({ where: { id: payment.external_reference }, include: { order: true } });
    if (!intent || intent.provider !== 'MERCADO_PAGO') throw new NotFoundException('Pago no encontrado');
    if (payment.currency_id !== 'PEN' || Math.round(Number(payment.transaction_amount) * 100) !== Math.round(Number(intent.amount) * 100)) throw new BadRequestException('Moneda o monto no coincide');
    if (intent.providerPaymentId && intent.providerPaymentId !== paymentId) throw new ConflictException('El intento ya tiene otro pago conciliado');
    if (process.env.NODE_ENV === 'production' && payment.live_mode !== true) throw new ForbiddenException('Pago de prueba no permitido en producción');
    const statuses: Record<string, PaymentStatus> = { approved: 'APPROVED', rejected: 'REJECTED', cancelled: 'CANCELLED', refunded: 'REFUNDED', pending: 'PENDING', in_process: 'PENDING' };
    const status = statuses[payment.status ?? ''];
    if (!status) return { received: true, updated: false };
    return this.applyVerifiedStatus(intent.id, status, correlationId, { paymentId });
  }

  private async applyVerifiedStatus(intentId: string, status: PaymentStatus, correlationId?: string, context: { adminId?: string; reason?: string; expected?: PaymentStatus; paymentId?: string } = {}) {
    const result = await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${intentId}))`;
      const current = await tx.paymentIntent.findUniqueOrThrow({ where: { id: intentId } });
      if (context.expected && current.status !== context.expected) throw new ConflictException('El pago ya fue revisado');
      if (current.providerPaymentId && context.paymentId && current.providerPaymentId !== context.paymentId) throw new ConflictException('Pago duplicado');
      const order = await tx.order.findUniqueOrThrow({ where: { id: current.orderId } });
      if (current.status === status || (['APPROVED', 'PAID', 'REFUNDED'].includes(current.status) && !['REFUNDED'].includes(status))) return { intent: current, order, changed: false };
      const intent = await tx.paymentIntent.update({ where: { id: intentId }, data: { status, verifiedAt: new Date(), reviewedBy: context.adminId, reviewReason: context.reason, providerPaymentId: context.paymentId } });
      const shouldConfirm = status === 'APPROVED' && order.status === 'PENDING';
      const claimed = await tx.order.updateMany({ where: { id: order.id, status: order.status, version: order.version }, data: { paymentStatus: status, version: { increment: 1 }, ...(shouldConfirm ? { status: 'CONFIRMED' } : {}) } });
      if (!claimed.count) throw new ConflictException('El pedido cambió durante la conciliación. Reintenta el evento.');
      const updated = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
      if (status === 'APPROVED' && order.status === 'CANCELLED' && !await tx.refund.findFirst({ where: { paymentIntentId: intentId, status: { not: 'REJECTED' } } })) {
        await tx.refund.create({ data: { orderId: order.id, paymentIntentId: intentId, amount: current.amount, requestedBy: order.customerId, reason: 'Pago recibido después de cancelar; requiere devolución real' } });
      }
      if (status === 'REFUNDED' && context.paymentId) {
        const refunds = await tx.refund.updateMany({ where: { paymentIntentId: intentId, status: { in: ['REQUESTED', 'APPROVED'] } }, data: { status: 'COMPLETED', providerReference: context.paymentId } });
        if (!refunds.count && !await tx.refund.findFirst({ where: { paymentIntentId: intentId, status: 'COMPLETED' } })) await tx.refund.create({ data: { orderId: order.id, paymentIntentId: intentId, amount: current.amount, requestedBy: order.customerId, reason: 'Devolución total confirmada por webhook verificado de Mercado Pago', status: 'COMPLETED', providerReference: context.paymentId } });
      }
      if (shouldConfirm) {
        await tx.subOrder.updateMany({ where: { orderId: order.id, status: 'PENDING' }, data: { status: 'CONFIRMED' } });
        await tx.orderStatusHistory.create({ data: { orderId: order.id, fromStatus: 'PENDING', toStatus: 'CONFIRMED', metadata: { source: 'verified-payment' } } });
      }
      await tx.auditLog.create({ data: { actorUserId: context.adminId, action: 'PAYMENT_VERIFIED', entity: 'PaymentIntent', entityId: intentId, metadata: { status, reason: context.reason ?? null, providerPaymentId: context.paymentId ?? null } } });
      await this.events.enqueue(tx, `payment.${status.toLowerCase()}`, { paymentIntentId: intentId, orderId: order.id, customerId: order.customerId }, correlationId);
      if (shouldConfirm) await this.events.enqueue(tx, 'order.confirmed', { orderId: order.id, customerId: order.customerId }, correlationId);
      return { intent, order: updated, changed: true };
    });
    return result;
  }
}
