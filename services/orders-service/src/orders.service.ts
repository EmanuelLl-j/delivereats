import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, PaymentMethod, PaymentStatus } from './generated/prisma';
import { EventPublisher } from '@delivereats/backend-kit';
import {
  OrderStatus as SharedOrderStatus,
  UserRole,
  type JwtPayload,
} from '@delivereats/shared-types';
import { canTransitionOrder } from '@delivereats/shared-utils';
import { RatingDto } from './dto';
import { OrdersGateway } from './orders.gateway';
import { PrismaService } from './prisma.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventPublisher,
    private readonly gateway: OrdersGateway,
  ) {}

  list(user: JwtPayload, status?: OrderStatus) {
    return this.prisma.order.findMany({
      where:
        user.role === UserRole.CUSTOMER
          ? { customerId: user.sub, status }
          : user.role === UserRole.MERCHANT
            ? { status, subOrders: { some: { merchant: { ownerUserId: user.sub } } } }
            : { status },
      include: {
        subOrders: { include: { merchant: true, items: true } },
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async get(user: JwtPayload, id: string) {
    const order = await this.orderDetail(id);
    const merchantOwns = order.subOrders.some((item) => item.merchant.ownerUserId === user.sub);
    if (user.role === UserRole.CUSTOMER && order.customerId !== user.sub)
      throw new ForbiddenException('No puedes consultar este pedido');
    if (user.role === UserRole.MERCHANT && !merchantOwns)
      throw new ForbiddenException('No puedes consultar este pedido');
    return order;
  }

  async transition(user: JwtPayload, id: string, to: OrderStatus, correlationId?: string) {
    const order = await this.orderDetail(id);
    if (user.role === UserRole.CUSTOMER) {
      if (order.customerId !== user.sub || to !== OrderStatus.CANCELLED)
        throw new ForbiddenException('No puedes realizar esta transición');
    } else if (user.role === UserRole.MERCHANT) {
      const owns = order.subOrders.some((item) => item.merchant.ownerUserId === user.sub);
      const merchantTransition =
        to === OrderStatus.SEARCHING_DRIVER ||
        to === OrderStatus.PREPARING ||
        to === OrderStatus.READY_FOR_PICKUP ||
        to === OrderStatus.CANCELLED;
      if (!owns || !merchantTransition) {
        throw new ForbiddenException('No puedes realizar esta transición');
      }
    } else if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'La app del repartidor debe reportar el avance mediante su asignación',
      );
    }
    return this.applyTransition(order, to, user.sub, correlationId);
  }

  async internalAssign(orderId: string, driverId: string, correlationId?: string) {
    const order = await this.orderDetail(orderId);
    if (order.status !== OrderStatus.SEARCHING_DRIVER) {
      throw new BadRequestException({
        code: 'ORDER_INVALID_STATE',
        message: 'El pedido ya no busca repartidor',
      });
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.SEARCHING_DRIVER, assignedDriverId: null },
        data: { status: OrderStatus.ASSIGNED, assignedDriverId: driverId },
      });
      if (!current.count)
        throw new BadRequestException({
          code: 'ORDER_ASSIGNMENT_RACE',
          message: 'El pedido ya fue asignado',
        });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: OrderStatus.SEARCHING_DRIVER,
          toStatus: OrderStatus.ASSIGNED,
          metadata: { driverId },
        },
      });
      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { subOrders: { include: { merchant: true } } },
      });
    });
    await this.afterTransition(updated, OrderStatus.ASSIGNED, correlationId);
    return updated;
  }

  internalDetails(orderId: string) {
    return this.orderDetail(orderId);
  }

  async internalTransition(
    orderId: string,
    to: OrderStatus,
    driverId: string,
    correlationId?: string,
  ) {
    const order = await this.orderDetail(orderId);
    if (order.assignedDriverId !== driverId)
      throw new ForbiddenException('El repartidor no está asignado a este pedido');
    return this.applyTransition(order, to, driverId, correlationId);
  }

  async markPickup(orderId: string, subOrderId: string, driverId: string, correlationId?: string) {
    const order = await this.orderDetail(orderId);
    if (order.assignedDriverId !== driverId)
      throw new ForbiddenException('El repartidor no está asignado a este pedido');
    const target = order.subOrders.find((item) => item.id === subOrderId);
    if (!target)
      throw new NotFoundException({
        code: 'SUBORDER_NOT_FOUND',
        message: 'Subpedido no encontrado',
      });
    const updated = await this.prisma.subOrder.update({
      where: { id: subOrderId },
      data: { status: OrderStatus.PICKING_UP, pickedUpAt: new Date() },
    });
    const remaining = await this.prisma.subOrder.count({ where: { orderId, pickedUpAt: null } });
    if (
      remaining === 0 &&
      canTransitionOrder(order.status as unknown as SharedOrderStatus, SharedOrderStatus.ON_THE_WAY)
    ) {
      await this.applyTransition(order, OrderStatus.ON_THE_WAY, driverId, correlationId);
    } else if (order.status === OrderStatus.READY_FOR_PICKUP) {
      await this.applyTransition(order, OrderStatus.PICKING_UP, driverId, correlationId);
    }
    return { subOrder: updated, remainingPickups: remaining };
  }

  async rate(customerId: string, orderId: string, dto: RatingDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId, status: OrderStatus.DELIVERED },
    });
    if (!order)
      throw new BadRequestException({
        code: 'ORDER_NOT_RATEABLE',
        message: 'Solo puedes calificar un pedido entregado propio',
      });
    return this.prisma.rating.create({
      data: {
        orderId,
        customerId,
        driverId: order.assignedDriverId,
        score: dto.score,
        comment: dto.comment,
      },
    });
  }

  private async applyTransition(
    order: Awaited<ReturnType<OrdersService['orderDetail']>>,
    to: OrderStatus,
    actorUserId: string,
    correlationId?: string,
  ) {
    if (
      !canTransitionOrder(
        order.status as unknown as SharedOrderStatus,
        to as unknown as SharedOrderStatus,
      )
    ) {
      throw new BadRequestException({
        code: 'ORDER_INVALID_STATE',
        message: `El pedido no puede pasar de ${order.status} a ${to}`,
      });
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: { status: to },
      });
      if (!claimed.count)
        throw new BadRequestException({
          code: 'ORDER_CONCURRENT_UPDATE',
          message: 'El pedido cambió de estado; vuelve a cargarlo',
        });
      await tx.subOrder.updateMany({
        where: {
          orderId: order.id,
          status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
        },
        data: { status: to },
      });
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, fromStatus: order.status, toStatus: to, actorUserId },
      });
      if (to === OrderStatus.DELIVERED && order.paymentMethod === PaymentMethod.CASH) {
        await tx.order.update({
          where: { id: order.id },
          data: { paymentStatus: PaymentStatus.PAID },
        });
        await tx.paymentIntent.updateMany({
          where: { orderId: order.id },
          data: { status: PaymentStatus.PAID, verifiedAt: new Date() },
        });
      }
      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: {
          subOrders: { include: { merchant: true, items: true } },
          payments: true,
          statusHistory: true,
        },
      });
    });
    await this.afterTransition(updated, to, correlationId);
    if (to === OrderStatus.SEARCHING_DRIVER) void this.requestDriver(updated, correlationId);
    return updated;
  }

  private async requestDriver(
    order: {
      id: string;
      deliveryAddress: string;
      deliveryLatitude: unknown;
      deliveryLongitude: unknown;
      deliveryFee: unknown;
      subOrders: Array<{
        merchantId: string;
        merchant: { name: string; latitude: unknown; longitude: unknown };
      }>;
    },
    correlationId?: string,
  ) {
    const response = await fetch(
      `${process.env.DRIVERS_SERVICE_URL ?? 'http://localhost:3003'}/internal/assignments/offer`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-service-secret': process.env.INTERNAL_SERVICE_SECRET ?? '',
          'x-correlation-id': correlationId ?? '',
        },
        body: JSON.stringify({
          orderId: order.id,
          pickupPoints: order.subOrders.map((subOrder) => ({
            merchantId: subOrder.merchantId,
            name: subOrder.merchant.name,
            latitude: Number(subOrder.merchant.latitude),
            longitude: Number(subOrder.merchant.longitude),
          })),
          destination: {
            address: order.deliveryAddress,
            latitude: Number(order.deliveryLatitude),
            longitude: Number(order.deliveryLongitude),
          },
          estimatedEarnings: Number(order.deliveryFee) * 0.8 + 2,
        }),
      },
    ).catch(() => null);
    if (!response?.ok) return;
    await response.json().catch(() => undefined);
  }

  private async afterTransition(
    order: {
      id: string;
      customerId: string;
      status: OrderStatus;
      subOrders: Array<{ merchant: { ownerUserId: string } }>;
    },
    to: OrderStatus,
    correlationId?: string,
  ) {
    const routing = to
      .toLowerCase()
      .replace('ready_for_pickup', 'ready')
      .replace('picking_up', 'picked_up');
    await this.events.publish(
      `order.${routing}`,
      { orderId: order.id, customerId: order.customerId, status: to },
      correlationId,
    );
    this.gateway.emitOrder(
      order,
      order.subOrders.map((item) => item.merchant.ownerUserId),
    );
  }

  private async orderDetail(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        subOrders: { orderBy: { pickupSequence: 'asc' }, include: { merchant: true, items: true } },
        payments: { orderBy: { createdAt: 'desc' } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        ratings: true,
      },
    });
    if (!order)
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Pedido no encontrado' });
    return order;
  }
}
