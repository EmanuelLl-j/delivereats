import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  Prisma,
} from '../generated/prisma';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { EventPublisher } from '@delivereats/backend-kit';
import { PrismaService } from '../prisma.service';

type OrderForPayment = Prisma.OrderGetPayload<{
  include: { subOrders: { include: { items: true; merchant: true } } };
}>;

export type PaymentIntentView = {
  provider: PaymentProvider;
  externalId?: string;
  checkoutUrl?: string;
  sandbox: boolean;
  sandboxCode?: string;
  qrPayload?: string;
};

export interface PaymentProviderAdapter {
  create(order: OrderForPayment): Promise<PaymentIntentView>;
  verify(externalId: string): Promise<PaymentStatus>;
}

class MockPaymentProvider implements PaymentProviderAdapter {
  async create(order: OrderForPayment): Promise<PaymentIntentView> {
    const code = `${order.paymentMethod}-SBX-${order.orderNumber}`;
    return {
      provider: PaymentProvider.MOCK,
      externalId: `mock_${order.id}`,
      sandbox: true,
      sandboxCode: code,
      qrPayload: `DELIVEREATS|SANDBOX|${code}|PEN|${order.total.toString()}`,
    };
  }

  async verify(): Promise<PaymentStatus> {
    return PaymentStatus.PENDING;
  }
}

class MercadoPagoProviderAdapter implements PaymentProviderAdapter {
  private readonly client: MercadoPagoConfig;

  constructor(accessToken: string) {
    this.client = new MercadoPagoConfig({ accessToken, options: { timeout: 8_000 } });
  }

  async create(order: OrderForPayment): Promise<PaymentIntentView> {
    const response = await new Preference(this.client).create({
      body: {
        items: [
          {
            id: order.id,
            title: `Pedido ${order.orderNumber}`,
            quantity: 1,
            unit_price: Number(order.total),
            currency_id: 'PEN',
          },
        ],
        external_reference: order.id,
        notification_url: `${process.env.PUBLIC_API_URL ?? 'http://localhost/api/orders'}/payments/webhook/mercadopago`,
        back_urls: {
          success: `${process.env.WEB_URL ?? 'http://localhost:3000'}/pago/exito`,
          failure: `${process.env.WEB_URL ?? 'http://localhost:3000'}/pago/error`,
          pending: `${process.env.WEB_URL ?? 'http://localhost:3000'}/pago/pendiente`,
        },
        auto_return: 'approved',
      },
    });
    if (!response.id)
      throw new ServiceUnavailableException('Mercado Pago no devolvió una preferencia válida');
    return {
      provider: PaymentProvider.MERCADO_PAGO,
      externalId: response.id,
      checkoutUrl: response.init_point ?? response.sandbox_init_point,
      sandbox: process.env.MERCADOPAGO_SANDBOX !== 'false',
    };
  }

  async verify(externalId: string): Promise<PaymentStatus> {
    const response = await new Payment(this.client).get({ id: externalId });
    if (response.status === 'approved') return PaymentStatus.APPROVED;
    if (response.status === 'rejected') return PaymentStatus.REJECTED;
    if (response.status === 'cancelled') return PaymentStatus.CANCELLED;
    if (response.status === 'refunded') return PaymentStatus.REFUNDED;
    return PaymentStatus.PENDING;
  }
}

@Injectable()
export class PaymentService {
  private readonly mock = new MockPaymentProvider();

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventPublisher,
  ) {}

  async createForOrder(orderId: string, correlationId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { subOrders: { include: { items: true, merchant: true } } },
    });
    if (!order)
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Pedido no encontrado' });

    const adapter = this.providerFor(order.paymentMethod);
    const view = await adapter.create(order);
    const intent = await this.prisma.paymentIntent.create({
      data: {
        orderId: order.id,
        provider: view.provider,
        method: order.paymentMethod,
        amount: order.total,
        externalId: view.externalId,
        providerReference: view.checkoutUrl,
        sandboxPayload: view as unknown as Prisma.InputJsonValue,
      },
    });
    await this.events.publish(
      'payment.created',
      {
        paymentIntentId: intent.id,
        orderId: order.id,
        method: order.paymentMethod,
        amount: order.total.toString(),
      },
      correlationId,
    );
    return { ...intent, client: view };
  }

  async get(intentId: string, userId: string, isAdmin: boolean) {
    const intent = await this.prisma.paymentIntent.findUnique({
      where: { id: intentId },
      include: { order: true },
    });
    if (!intent)
      throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND', message: 'Pago no encontrado' });
    if (!isAdmin && intent.order.customerId !== userId)
      throw new ForbiddenException('No puedes consultar este pago');
    return intent;
  }

  async decideMock(intentId: string, approved: boolean, correlationId?: string) {
    if ((process.env.PAYMENTS_MODE ?? 'mock') !== 'mock') {
      throw new ForbiddenException({
        code: 'PAYMENT_NOT_MOCK',
        message: 'La aprobación manual solo existe en modo mock',
      });
    }
    const intent = await this.prisma.paymentIntent.findUnique({
      where: { id: intentId },
      include: { order: true },
    });
    if (!intent)
      throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND', message: 'Pago no encontrado' });
    if (intent.provider !== PaymentProvider.MOCK)
      throw new ForbiddenException('El pago no pertenece al proveedor mock');
    return this.applyVerifiedStatus(
      intent.id,
      approved ? PaymentStatus.APPROVED : PaymentStatus.REJECTED,
      correlationId,
    );
  }

  async verifyMercadoPago(externalId: string, correlationId?: string) {
    const intent = await this.prisma.paymentIntent.findFirst({ where: { externalId } });
    if (!intent)
      throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND', message: 'Pago no encontrado' });
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token)
      throw new ServiceUnavailableException('MERCADOPAGO_ACCESS_TOKEN no está configurado');
    const status = await new MercadoPagoProviderAdapter(token).verify(externalId);
    return this.applyVerifiedStatus(intent.id, status, correlationId);
  }

  private providerFor(method: PaymentMethod): PaymentProviderAdapter {
    if ((process.env.PAYMENTS_MODE ?? 'mock') === 'mock' || method !== PaymentMethod.MERCADO_PAGO) {
      return this.mock;
    }
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token)
      throw new ServiceUnavailableException('MERCADOPAGO_ACCESS_TOKEN no está configurado');
    return new MercadoPagoProviderAdapter(token);
  }

  private async applyVerifiedStatus(
    intentId: string,
    status: PaymentStatus,
    correlationId?: string,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const intent = await tx.paymentIntent.update({
        where: { id: intentId },
        data: { status, verifiedAt: new Date() },
      });
      const order = await tx.order.findUniqueOrThrow({ where: { id: intent.orderId } });
      const shouldConfirm =
        status === PaymentStatus.APPROVED && order.status === OrderStatus.PENDING;
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: status,
          ...(shouldConfirm ? { status: OrderStatus.CONFIRMED } : {}),
        },
      });
      if (shouldConfirm) {
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: OrderStatus.PENDING,
            toStatus: OrderStatus.CONFIRMED,
            metadata: { source: 'payment' },
          },
        });
      }
      return { intent, order: updatedOrder };
    });
    await this.events.publish(
      status === PaymentStatus.APPROVED ? 'payment.approved' : 'payment.rejected',
      {
        paymentIntentId: result.intent.id,
        orderId: result.order.id,
        customerId: result.order.customerId,
      },
      correlationId,
    );
    if (status === PaymentStatus.APPROVED) {
      await this.events.publish(
        'order.confirmed',
        { orderId: result.order.id, customerId: result.order.customerId },
        correlationId,
      );
    }
    return result;
  }
}
