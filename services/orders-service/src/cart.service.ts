import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  Prisma,
} from './generated/prisma';
import { calculateCheckout, generateOrderNumber } from '@delivereats/shared-utils';
import { EventPublisher } from '@delivereats/backend-kit';
import { AddCartItemDto, CheckoutDto, UpdateCartItemDto } from './dto';
import { OrdersGateway } from './orders.gateway';
import { PaymentService } from './payments/payment.service';
import { PrismaService } from './prisma.service';

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentService,
    private readonly events: EventPublisher,
    private readonly gateway: OrdersGateway,
  ) {}

  async get(customerId: string) {
    return this.prisma.cart.upsert({
      where: { customerId },
      create: { customerId },
      update: {},
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
          include: { product: true, merchant: true },
        },
      },
    });
  }

  async add(customerId: string, dto: AddCartItemDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { merchant: true },
    });
    if (
      !product ||
      !product.isAvailable ||
      !product.merchant.isActive ||
      !product.merchant.isOpen
    ) {
      throw new BadRequestException({
        code: 'PRODUCT_UNAVAILABLE',
        message: 'El producto o comercio no está disponible',
      });
    }
    const cart = await this.prisma.cart.upsert({
      where: { customerId },
      create: { customerId },
      update: {},
    });
    const current = await this.prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId: product.id } },
    });
    const quantity = (current?.quantity ?? 0) + dto.quantity;
    if (quantity > 20)
      throw new BadRequestException({
        code: 'CART_QUANTITY_LIMIT',
        message: 'La cantidad máxima por producto es 20',
      });
    await this.prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId: product.id } },
      create: {
        cartId: cart.id,
        productId: product.id,
        merchantId: product.merchantId,
        quantity: dto.quantity,
        notes: dto.notes,
      },
      update: { quantity, notes: dto.notes },
    });
    return this.get(customerId);
  }

  async update(customerId: string, itemId: string, dto: UpdateCartItemDto) {
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cart: { customerId } },
    });
    if (!item)
      throw new NotFoundException({
        code: 'CART_ITEM_NOT_FOUND',
        message: 'Producto no encontrado en tu carrito',
      });
    await this.prisma.cartItem.update({ where: { id: itemId }, data: dto });
    return this.get(customerId);
  }

  async remove(customerId: string, itemId: string) {
    const result = await this.prisma.cartItem.deleteMany({
      where: { id: itemId, cart: { customerId } },
    });
    if (!result.count)
      throw new NotFoundException({
        code: 'CART_ITEM_NOT_FOUND',
        message: 'Producto no encontrado en tu carrito',
      });
    return this.get(customerId);
  }

  async checkout(customerId: string, dto: CheckoutDto, correlationId?: string) {
    const created = await this.prisma.$transaction(
      async (tx) => {
        const cart = await tx.cart.findUnique({
          where: { customerId },
          include: { items: { include: { product: true, merchant: true } } },
        });
        if (!cart?.items.length)
          throw new BadRequestException({ code: 'CART_EMPTY', message: 'El carrito está vacío' });
        if (
          cart.items.some(
            (item) => !item.product.isAvailable || !item.merchant.isActive || !item.merchant.isOpen,
          )
        ) {
          throw new BadRequestException({
            code: 'CART_PRODUCT_UNAVAILABLE',
            message: 'Uno o más productos ya no están disponibles',
          });
        }

        const itemTotals = cart.items.map((item) => Number(item.product.price) * item.quantity);
        const rawSubtotal = itemTotals.reduce((sum, value) => sum + value, 0);
        let promotion:
          | {
              id: string;
              code: string;
              type: 'PERCENTAGE' | 'FIXED' | 'FREE_DELIVERY';
              value: number;
              maximumDiscount: number | null;
            }
          | undefined;
        if (dto.promoCode) {
          const record = await tx.promotion.findUnique({ where: { code: dto.promoCode } });
          const now = new Date();
          if (
            !record ||
            !record.isActive ||
            record.startsAt > now ||
            record.expiresAt < now ||
            rawSubtotal < Number(record.minimumAmount) ||
            (record.usageLimit != null && record.usageCount >= record.usageLimit)
          ) {
            throw new BadRequestException({
              code: 'PROMOTION_INVALID',
              message: 'El cupón no es válido para este pedido',
            });
          }
          promotion = {
            id: record.id,
            code: record.code,
            type: record.type,
            value: Number(record.value),
            maximumDiscount: record.maximumDiscount == null ? null : Number(record.maximumDiscount),
          };
        }
        const totals = calculateCheckout({ itemTotals, promotion });
        const year = new Date().getUTCFullYear();
        const sequence = await tx.orderSequence.upsert({
          where: { year },
          create: { year, value: 1 },
          update: { value: { increment: 1 } },
        });
        const groups = new Map<string, typeof cart.items>();
        for (const item of cart.items)
          groups.set(item.merchantId, [...(groups.get(item.merchantId) ?? []), item]);
        const cash = dto.paymentMethod === PaymentMethod.CASH;
        const order = await tx.order.create({
          data: {
            orderNumber: generateOrderNumber(sequence.value),
            customerId,
            deliveryAddressId: dto.deliveryAddressId,
            deliveryAddress: dto.deliveryAddress,
            deliveryLatitude: dto.deliveryLatitude,
            deliveryLongitude: dto.deliveryLongitude,
            status: cash ? OrderStatus.CONFIRMED : OrderStatus.PENDING,
            subtotal: totals.subtotal,
            deliveryFee: totals.deliveryFee,
            serviceFee: totals.serviceFee,
            discount: totals.discount,
            total: totals.total,
            paymentMethod: dto.paymentMethod,
            paymentStatus: PaymentStatus.PENDING,
            promoCode: promotion?.code,
            subOrders: {
              create: Array.from(groups.entries()).map(([merchantId, items], pickupSequence) => ({
                merchantId,
                status: cash ? OrderStatus.CONFIRMED : OrderStatus.PENDING,
                pickupSequence: pickupSequence + 1,
                subtotal: items.reduce(
                  (sum, item) => sum + Number(item.product.price) * item.quantity,
                  0,
                ),
                items: {
                  create: items.map((item) => ({
                    productId: item.productId,
                    productName: item.product.name,
                    quantity: item.quantity,
                    unitPrice: item.product.price,
                    subtotal: Number(item.product.price) * item.quantity,
                    notes: item.notes,
                  })),
                },
              })),
            },
            statusHistory: {
              create: {
                toStatus: cash ? OrderStatus.CONFIRMED : OrderStatus.PENDING,
                metadata: { source: 'checkout' },
              },
            },
            ...(cash
              ? {
                  payments: {
                    create: {
                      provider: PaymentProvider.MOCK,
                      method: PaymentMethod.CASH,
                      amount: totals.total,
                      status: PaymentStatus.PENDING,
                      sandboxPayload: { cashOnDelivery: true },
                    },
                  },
                }
              : {}),
          },
          include: { subOrders: { include: { items: true, merchant: true } }, payments: true },
        });
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        if (promotion)
          await tx.promotion.update({
            where: { id: promotion.id },
            data: { usageCount: { increment: 1 } },
          });
        return order;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    const payment =
      created.paymentMethod === PaymentMethod.CASH
        ? created.payments[0]
        : await this.payments.createForOrder(created.id, correlationId);
    const ownerIds = created.subOrders.map((subOrder) => subOrder.merchant.ownerUserId);
    this.gateway.emitOrder(created, ownerIds);
    await this.events.publish(
      'order.created',
      {
        orderId: created.id,
        orderNumber: created.orderNumber,
        customerId: created.customerId,
        merchantIds: created.subOrders.map((item) => item.merchantId),
        total: created.total.toString(),
      },
      correlationId,
    );
    if (created.paymentMethod === PaymentMethod.CASH) {
      await this.events.publish(
        'order.confirmed',
        { orderId: created.id, customerId },
        correlationId,
      );
    }
    return { order: created, payment };
  }
}
