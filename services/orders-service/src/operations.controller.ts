import { BadRequestException, Body, ConflictException, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Roles, requireOwnedFile } from '@delivereats/backend-kit';
import { UserRole, type JwtPayload } from '@delivereats/shared-types';
import { PrismaService } from './prisma.service';
import { PaymentConfigurationDto, RefundRequestDto, RefundReviewDto } from './operations.dto';

export function dateRange(period = 'day', from?: string, to?: string) {
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  const start = new Date((from ?? day) + 'T00:00:00-05:00');
  const end = new Date((to ?? day) + 'T23:59:59.999-05:00');
  if (!from && period === 'week') start.setUTCDate(start.getUTCDate() - 6);
  if (!from && period === 'month') start.setUTCDate(start.getUTCDate() - 29);
  if (![start.getTime(), end.getTime()].every(Number.isFinite) || start > end || end.getTime() - start.getTime() > 366 * 86_400_000) throw new BadRequestException('Selecciona un rango válido de hasta un año');
  return { gte: start, lte: end };
}

@Controller()
export class OperationsController {
  constructor(private readonly prisma: PrismaService) {}
  @Roles(UserRole.ADMIN) @Get('admin/payment-configuration') configurations() { return this.prisma.paymentConfiguration.findMany(); }
  @Roles(UserRole.ADMIN) @Patch('admin/payment-configuration/:method') async configure(@CurrentUser() user: JwtPayload, @Param('method') method: string, @Body() dto: PaymentConfigurationDto) {
    if (!['CASH', 'MERCADO_PAGO', 'YAPE_MANUAL', 'PLIN_MANUAL'].includes(method)) throw new BadRequestException('Método inválido');
    if (dto.qrFileId) await requireOwnedFile(user.sub, dto.qrFileId, ['PAYMENT_QR']);
    return this.prisma.$transaction(async tx => {
      const { qrFileId, ...data } = dto;
      const config = await tx.paymentConfiguration.upsert({ where: { method }, create: { method, ...data, ...(qrFileId ? { qrImageUrl: `/api/users/files/public/${qrFileId}` } : {}) }, update: { ...data, ...(qrFileId ? { qrImageUrl: `/api/users/files/public/${qrFileId}` } : {}) } });
      if (config.enabled && method.endsWith('_MANUAL') && (!config.accountLabel || !config.instructions || !config.qrImageUrl)) throw new BadRequestException('Completa cuenta, instrucciones y QR antes de habilitar el pago manual');
      await tx.auditLog.create({ data: { actorUserId: user.sub, action: 'PAYMENT_CONFIGURATION_UPDATED', entity: 'PaymentConfiguration', entityId: method, metadata: { enabled: config.enabled } } });
      return config;
    });
  }
  @Roles(UserRole.ADMIN) @Get('admin/payments') payments() { return this.prisma.paymentIntent.findMany({ include: { order: { select: { orderNumber: true, customerId: true, status: true } } }, orderBy: { createdAt: 'desc' }, take: 200 }); }
  @Roles(UserRole.ADMIN) @Get('admin/refunds') refunds() { return this.prisma.refund.findMany({ include: { order: { select: { orderNumber: true } } }, orderBy: { createdAt: 'desc' }, take: 200 }); }
  @Roles(UserRole.CUSTOMER) @Post('orders/:id/refunds') async requestRefund(@CurrentUser() user: JwtPayload, @Param('id') orderId: string, @Body() dto: RefundRequestDto) {
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${orderId}))`;
      const order = await tx.order.findFirst({ where: { id: orderId, customerId: user.sub }, include: { payments: true, refunds: true } });
      const payment = order?.payments.find(row => ['APPROVED', 'PAID'].includes(row.status));
      if (!order || !payment) throw new BadRequestException('No existe un pago verificado para reembolsar');
      if (order.refunds.some(row => row.status !== 'REJECTED')) throw new ConflictException('Ya existe una solicitud de reembolso');
      return tx.refund.create({ data: { orderId, paymentIntentId: payment.id, requestedBy: user.sub, amount: payment.amount, reason: dto.reason } });
    });
  }
  @Roles(UserRole.ADMIN) @Patch('admin/refunds/:id') async refund(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: RefundReviewDto) {
    if (dto.evidenceFileId) await requireOwnedFile(user.sub, dto.evidenceFileId, ['PAYMENT_EVIDENCE']);
    return this.prisma.$transaction(async tx => {
      const refund = await tx.refund.findUniqueOrThrow({ where: { id } });
      const payment = await tx.paymentIntent.findUniqueOrThrow({ where: { id: refund.paymentIntentId } });
      if (!['REQUESTED', 'APPROVED'].includes(refund.status)) throw new ConflictException('La solicitud ya fue resuelta');
      if (dto.status === 'COMPLETED' && (refund.status !== 'APPROVED' || !dto.providerReference || !dto.evidenceFileId)) throw new BadRequestException('Para conciliar una devolución aprobada registra referencia externa y comprobante');
      if (dto.status === 'COMPLETED' && payment.provider === 'MERCADO_PAGO') throw new BadRequestException('Las devoluciones Mercado Pago se concilian exclusivamente mediante su webhook verificado');
      const result = await tx.refund.update({ where: { id }, data: { status: dto.status, reviewedBy: user.sub, providerReference: dto.providerReference } });
      await tx.auditLog.create({ data: { actorUserId: user.sub, action: 'REFUND_REVIEWED', entity: 'Refund', entityId: id, metadata: { status: dto.status, reason: dto.reason, evidenceFileId: dto.evidenceFileId ?? null } } });
      if (dto.status === 'COMPLETED') {
        const refunded = await tx.refund.aggregate({ where: { paymentIntentId: payment.id, status: 'COMPLETED' }, _sum: { amount: true } });
        if (Number(refunded._sum.amount) >= Number(payment.amount)) {
          await tx.paymentIntent.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } });
          await tx.order.update({ where: { id: refund.orderId }, data: { paymentStatus: 'REFUNDED' } });
        }
      }
      return result;
    });
  }
  @Roles(UserRole.ADMIN) @Get('admin/system') async system() {
    return Promise.all(['users', 'orders', 'drivers', 'notifications'].map(async (service, index) => {
      const base = process.env[`${service.toUpperCase()}_SERVICE_URL`] ?? `http://127.0.0.1:${3001 + index}`;
      try { const response = await fetch(`${base}/ready`, { signal: AbortSignal.timeout(5_000) }); return { service, ...(await response.json() as object), reachable: true }; }
      catch { return { service, status: 'unreachable', reachable: false }; }
    }));
  }
  @Roles(UserRole.ADMIN) @Get('admin/analytics') async analytics(@Query('period') period?: string, @Query('from') from?: string, @Query('to') to?: string) {
    const range = dateRange(period, from, to);
    const orders = await this.prisma.order.findMany({ where: { createdAt: range }, select: { createdAt: true, status: true, type: true, total: true, completedAt: true } });
    const hours = Array.from({ length: 24 }, (_, index) => ({ hour: `${String(index).padStart(2, '0')}h`, orders: 0, delivered: 0 }));
    for (const order of orders) { const index = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'America/Lima' }).format(order.createdAt)); const point = hours[index]; if (point) { point.orders++; if (order.status === 'DELIVERED') point.delivered++; } }
    const delivered = orders.filter(order => order.status === 'DELIVERED');
    const times = delivered.filter(order => order.completedAt).map(order => (order.completedAt!.getTime() - order.createdAt.getTime()) / 60_000);
    return { from: range.gte, to: range.lte, orders: orders.length, delivered: delivered.length, cancelled: orders.filter(order => order.status === 'CANCELLED').length, shipments: orders.filter(order => order.type === 'PERSONAL_SHIPMENT').length, revenue: delivered.reduce((sum, order) => sum + Number(order.total), 0), averageDeliveryMinutes: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null, hours };
  }
  @Roles(UserRole.MERCHANT) @Get('commerce/metrics') async merchantMetrics(@CurrentUser() user: JwtPayload, @Query('period') period?: string, @Query('from') from?: string, @Query('to') to?: string) {
    const range = dateRange(period, from, to);
    const rows = await this.prisma.subOrder.findMany({ where: { merchant: { ownerUserId: user.sub }, createdAt: range }, include: { items: true, order: { select: { orderNumber: true, createdAt: true } } }, orderBy: { createdAt: 'desc' } });
    const completed = rows.filter(row => row.status === 'DELIVERED');
    const revenue = completed.reduce((sum, row) => sum + Number(row.subtotal), 0);
    const prepared = rows.filter(row => row.preparingAt && row.readyAt);
    const preparation = prepared.reduce((sum, row) => sum + (row.readyAt!.getTime() - row.preparingAt!.getTime()) / 60_000, 0);
    return { from: range.gte, to: range.lte, orders: rows.length, completed: completed.length, revenue, averageTicket: completed.length ? revenue / completed.length : 0, averagePreparationMinutes: prepared.length ? Math.round(preparation / prepared.length) : null, history: rows };
  }
}
