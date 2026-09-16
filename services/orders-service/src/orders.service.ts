import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OrderStatus, Prisma } from './generated/prisma';
import { EventPublisher, internalRequest, requireLegal } from '@delivereats/backend-kit';
import { UserRole, type JwtPayload } from '@delivereats/shared-types';
import { RatingDto, SubOrderTransitionDto } from './dto';
import { OrdersGateway } from './orders.gateway';
import { PrismaService } from './prisma.service';
import { publicMerchant } from './public-views';

const detailInclude = {
  subOrders: { orderBy: { pickupSequence: 'asc' as const }, include: { merchant: true, items: true } },
  payments: { orderBy: { createdAt: 'desc' as const } },
  shipment: { omit: { pickupVerificationCode: true as const, deliveryVerificationCode: true as const } },
  statusHistory: { orderBy: { createdAt: 'asc' as const } }, ratings: true,
};
type Detail = Prisma.OrderGetPayload<{ include: typeof detailInclude }>;

@Injectable()
export class OrdersService implements OnModuleInit, OnModuleDestroy {
  private dispatchTimer?: NodeJS.Timeout;
  private dispatching = false;
  constructor(private readonly prisma: PrismaService, private readonly events: EventPublisher, private readonly gateway: OrdersGateway) {}

  onModuleInit() { this.dispatchTimer = setInterval(() => void this.dispatchPending().catch(() => undefined), 5_000); this.dispatchTimer.unref(); }
  onModuleDestroy() { if (this.dispatchTimer) clearInterval(this.dispatchTimer); }

  async list(user: JwtPayload, status?: OrderStatus) {
    if (status && !Object.values(OrderStatus).includes(status)) throw new BadRequestException('Estado inválido');
    const orders = await this.prisma.order.findMany({
      where: { status, ...(user.role === UserRole.CUSTOMER ? { customerId: user.sub } : user.role === UserRole.MERCHANT ? { subOrders: { some: { merchant: { ownerUserId: user.sub } } } } : {}) },
      include: detailInclude, orderBy: { createdAt: 'desc' }, take: 100,
    });
    return orders.map(order => this.view(order, user));
  }

  async get(user: JwtPayload, id: string) {
    const order = await this.orderDetail(id);
    if (user.role === UserRole.CUSTOMER && order.customerId !== user.sub) throw new ForbiddenException('No puedes consultar este pedido');
    if (user.role === UserRole.MERCHANT && !order.subOrders.some(sub => sub.merchant.ownerUserId === user.sub)) throw new ForbiddenException('No puedes consultar este pedido');
    if (![UserRole.CUSTOMER, UserRole.MERCHANT, UserRole.ADMIN].includes(user.role)) throw new ForbiddenException();
    return this.view(order, user);
  }

  private view(order: Detail, user?: JwtPayload) {
    if (user?.role === UserRole.ADMIN) return order;
    if (user?.role === UserRole.MERCHANT) return {
      id: order.id, orderNumber: order.orderNumber, status: order.status, type: order.type, createdAt: order.createdAt, paymentStatus: order.paymentStatus,
      subOrders: order.subOrders.filter(sub => sub.merchant.ownerUserId === user.sub).map(sub => ({ ...sub, merchant: publicMerchant(sub.merchant) })),
    };
    return { ...order,
      subOrders: order.subOrders.map(sub => ({ ...sub, merchant: publicMerchant(sub.merchant) })),
      shipment: order.shipment ? { ...order.shipment, declarationEvidence: undefined, reviewedBy: undefined, verificationAttempts: undefined, verificationLockedUntil: undefined } : null,
      statusHistory: order.statusHistory.map(row => ({ id: row.id, toStatus: row.toStatus, createdAt: row.createdAt })),
      payments: user ? order.payments : undefined,
    };
  }

  async transition(user: JwtPayload, id: string, to: OrderStatus, correlationId?: string) {
    const order = await this.orderDetail(id);
    if (user.role === UserRole.MERCHANT) throw new ForbiddenException('Actualiza tu subpedido, no el pedido completo');
    if (user.role === UserRole.CUSTOMER && (order.customerId !== user.sub || to !== 'CANCELLED' || !['PENDING', 'CONFIRMED', 'REQUIRES_REVIEW'].includes(order.status) || order.subOrders.some(sub => sub.preparingAt))) throw new ForbiddenException('Este pedido requiere una solicitud de soporte para cancelarse');
    if (![UserRole.CUSTOMER, UserRole.ADMIN].includes(user.role) || to !== 'CANCELLED') throw new ForbiddenException('Esta transición corresponde al flujo operativo');
    if (['DELIVERED', 'CANCELLED'].includes(order.status)) throw new ConflictException('El pedido ya terminó');
    const result = await this.prisma.$transaction(async tx => {
      const claimed = await tx.order.updateMany({ where: { id, version: order.version, status: order.status }, data: { status: 'CANCELLED', cancelledAt: new Date(), version: { increment: 1 } } });
      if (!claimed.count) throw new ConflictException('El pedido cambió; vuelve a cargarlo');
      await tx.subOrder.updateMany({ where: { orderId: id, status: { not: 'DELIVERED' } }, data: { status: 'CANCELLED' } });
      await tx.orderStatusHistory.create({ data: { orderId: id, fromStatus: order.status, toStatus: 'CANCELLED', actorUserId: user.sub } });
      // A cancellation never pretends that an external refund has happened.
      const paid = order.payments.find(payment => ['APPROVED', 'PAID'].includes(payment.status));
      if (paid && !await tx.refund.findFirst({ where: { paymentIntentId: paid.id, status: { not: 'REJECTED' } } })) await tx.refund.create({ data: { orderId: id, paymentIntentId: paid.id, amount: paid.amount, reason: 'Pedido cancelado: requiere conciliación y devolución', requestedBy: user.sub } });
      await tx.auditLog.create({ data: { actorUserId: user.sub, action: 'ORDER_CANCELLED', entity: 'Order', entityId: id } });
      return this.storeChange(tx, id, correlationId);
    });
    this.changed(result);
    return this.view(result, user);
  }

  async transitionSubOrder(user: JwtPayload, subOrderId: string, dto: SubOrderTransitionDto) {
    if (dto.status === 'CANCELLED') return this.rejectSubOrder(user, subOrderId, dto.reason);
    const result = await this.prisma.$transaction(async tx => {
      const sub = await tx.subOrder.findUniqueOrThrow({ where: { id: subOrderId }, include: { merchant: true, order: true } });
      if (user.role !== UserRole.ADMIN && sub.merchant.ownerUserId !== user.sub) throw new ForbiddenException('Este subpedido no pertenece a tu comercio');
      if (sub.merchant.applicationStatus !== 'APPROVED' || !sub.merchant.isActive) throw new ForbiddenException('Comercio no aprobado');
      if (['PENDING', 'CANCELLED', 'DELIVERED', 'REQUIRES_REVIEW'].includes(sub.order.status)) throw new ConflictException('El pedido aún no puede prepararse');
      const from = dto.status === 'PREPARING' ? 'CONFIRMED' : 'PREPARING';
      const claimed = await tx.subOrder.updateMany({ where: { id: subOrderId, status: from }, data: { status: dto.status, ...(dto.status === 'PREPARING' ? { acceptedAt: new Date(), preparingAt: new Date() } : { readyAt: new Date() }) } });
      if (!claimed.count) throw new ConflictException('El subpedido cambió o la transición no es válida');
      const all = await tx.subOrder.findMany({ where: { orderId: sub.orderId } });
      const status = all.every(row => row.status === 'READY_FOR_PICKUP') ? 'SEARCHING_DRIVER' : 'PREPARING';
      const parent = await tx.order.updateMany({ where: { id: sub.orderId, version: sub.order.version }, data: { status, version: { increment: 1 } } });
      if (!parent.count) throw new ConflictException('Otro comercio actualizó el pedido; vuelve a intentar');
      await tx.auditLog.create({ data: { actorUserId: user.sub, action: 'SUBORDER_UPDATED', entity: 'SubOrder', entityId: subOrderId, metadata: { from, to: dto.status } } });
      if (status !== sub.order.status) await tx.orderStatusHistory.create({ data: { orderId: sub.orderId, fromStatus: sub.order.status, toStatus: status, actorUserId: user.sub } });
      return this.storeChange(tx, sub.orderId);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    this.changed(result);
    return this.view(result, user);
  }

  private async rejectSubOrder(user: JwtPayload, subOrderId: string, reason?: string) {
    if (!reason || reason.trim().length < 10) throw new BadRequestException('Describe el motivo del rechazo (mínimo 10 caracteres)');
    const result = await this.prisma.$transaction(async tx => {
      const sub = await tx.subOrder.findUniqueOrThrow({ where: { id: subOrderId }, include: { merchant: true, order: { include: detailInclude } } });
      if (user.role !== UserRole.ADMIN && sub.merchant.ownerUserId !== user.sub) throw new ForbiddenException('No administras este subpedido');
      const order = sub.order;
      if (!['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'].includes(sub.status) || ['CANCELLED', 'DELIVERED', 'ON_THE_WAY', 'PICKING_UP'].includes(order.status) || order.subOrders.some(row => row.pickedUpAt)) throw new ConflictException('Ya comenzó la recogida o el pedido terminó; registra una incidencia');
      const claimed = await tx.order.updateMany({ where: { id: order.id, version: order.version, status: order.status }, data: { status: 'CANCELLED', version: { increment: 1 }, cancelledAt: new Date() } });
      if (!claimed.count) throw new ConflictException('El pedido cambió durante el rechazo');
      await tx.subOrder.updateMany({ where: { orderId: order.id }, data: { status: 'CANCELLED' } });
      await tx.subOrder.update({ where: { id: subOrderId }, data: { rejectionReason: reason.trim() } });
      const paid = order.payments.find(row => ['APPROVED', 'PAID'].includes(row.status));
      if (paid && !await tx.refund.findFirst({ where: { paymentIntentId: paid.id, status: { not: 'REJECTED' } } })) await tx.refund.create({ data: { orderId: order.id, paymentIntentId: paid.id, amount: paid.amount, requestedBy: user.sub, reason: 'Rechazo del comercio: ' + reason.trim() } });
      await tx.orderStatusHistory.create({ data: { orderId: order.id, fromStatus: order.status, toStatus: 'CANCELLED', actorUserId: user.sub, metadata: { rejectedSubOrderId: subOrderId, reason } } });
      await tx.auditLog.create({ data: { actorUserId: user.sub, action: 'MERCHANT_REJECTED_ORDER', entity: 'SubOrder', entityId: subOrderId, metadata: { reason, orderId: order.id, policy: 'FULL_ORDER_CANCEL_BEFORE_PICKUP' } } });
      await this.events.enqueue(tx, 'order.cancelled', { orderId: order.id, customerId: order.customerId, status: 'CANCELLED' });
      return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: detailInclude });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    this.gateway.emitOrder({ id: result.id, customerId: result.customerId, status: result.status }, result.subOrders.map(sub => sub.merchant.ownerUserId));
    return this.view(result, user);
  }

  async internalAssign(orderId: string, driverId: string, correlationId?: string) {
    const order = await this.orderDetail(orderId);
    if (order.assignedDriverId === driverId && ['ASSIGNED', 'PICKING_UP', 'ON_THE_WAY'].includes(order.status)) return { id: order.id, status: order.status, assignedDriverId: driverId };
    if (order.status !== 'SEARCHING_DRIVER') throw new ConflictException('El pedido ya no busca repartidor');
    const updated = await this.prisma.$transaction(async tx => {
      const claimed = await tx.order.updateMany({ where: { id: orderId, status: 'SEARCHING_DRIVER', assignedDriverId: null, version: order.version }, data: { status: 'ASSIGNED', assignedDriverId: driverId, version: { increment: 1 } } });
      if (!claimed.count) throw new ConflictException('El pedido ya fue asignado o cambió');
      await tx.orderStatusHistory.create({ data: { orderId, fromStatus: 'SEARCHING_DRIVER', toStatus: 'ASSIGNED', metadata: { driverId } } });
      return this.storeChange(tx, orderId, correlationId);
    });
    this.changed(updated);
    return { id: updated.id, status: updated.status, assignedDriverId: driverId };
  }

  async internalDetails(orderId: string) { return this.view(await this.orderDetail(orderId)); }

  async context(orderId: string) {
    return this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { id: true, customerId: true, assignedDriverId: true, status: true, type: true, completedAt: true, cancelledAt: true } });
  }

  async participation(orderId: string, userId: string) {
    return { allowed: Boolean(await this.prisma.order.findFirst({ where: { id: orderId, OR: [{ customerId: userId }, { subOrders: { some: { merchant: { ownerUserId: userId } } } }] }, select: { id: true } })) };
  }

  async internalTransition(orderId: string, to: OrderStatus, driverId: string, correlationId?: string) {
    const order = await this.orderDetail(orderId);
    if (order.assignedDriverId !== driverId) throw new ForbiddenException('El repartidor no está asignado');
    if (order.type === 'PERSONAL_SHIPMENT') throw new ForbiddenException('Este envío requiere el código de verificación');
    if (to === order.status && ['ON_THE_WAY', 'DELIVERED'].includes(to)) return { id: orderId, status: to };
    if (to !== 'DELIVERED' || order.status !== 'ON_THE_WAY' || order.subOrders.some(sub => !sub.pickedUpAt)) throw new ConflictException('Debes recoger todos los subpedidos antes de entregar');
    const updated = await this.prisma.$transaction(async tx => {
      const claimed = await tx.order.updateMany({ where: { id: orderId, status: 'ON_THE_WAY', version: order.version }, data: { status: 'DELIVERED', completedAt: new Date(), version: { increment: 1 }, ...(order.paymentMethod === 'CASH' ? { paymentStatus: 'PAID' } : {}) } });
      if (!claimed.count) throw new ConflictException('El pedido cambió');
      await tx.subOrder.updateMany({ where: { orderId }, data: { status: 'DELIVERED' } });
      if (order.paymentMethod === 'CASH') await tx.paymentIntent.updateMany({ where: { orderId, provider: 'CASH' }, data: { status: 'PAID', verifiedAt: new Date() } });
      await tx.orderStatusHistory.create({ data: { orderId, fromStatus: 'ON_THE_WAY', toStatus: 'DELIVERED', metadata: { driverId } } });
      return this.storeChange(tx, orderId, correlationId);
    });
    this.changed(updated);
    return { id: updated.id, status: updated.status };
  }

  async markPickup(orderId: string, subOrderId: string, driverId: string, correlationId?: string) {
    const result = await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${orderId}))`;
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: detailInclude });
      if (order.assignedDriverId !== driverId || order.type !== 'MARKETPLACE') throw new ForbiddenException('Recogida no autorizada');
      if (!['ASSIGNED', 'PICKING_UP'].includes(order.status)) throw new ConflictException('El pedido no está en etapa de recogida');
      const target = order.subOrders.find(sub => sub.id === subOrderId);
      if (!target) throw new NotFoundException('Subpedido no encontrado');
      if (!target.pickedUpAt && target.status !== 'READY_FOR_PICKUP') throw new ConflictException('El comercio aún no marcó el pedido como listo');
      await tx.subOrder.update({ where: { id: subOrderId }, data: { status: 'PICKING_UP', pickedUpAt: target.pickedUpAt ?? new Date() } });
      const remaining = await tx.subOrder.count({ where: { orderId, pickedUpAt: null } });
      const status = remaining ? 'PICKING_UP' : 'ON_THE_WAY';
      await tx.order.update({ where: { id: orderId }, data: { status, version: { increment: 1 } } });
      if (order.status !== status) await tx.orderStatusHistory.create({ data: { orderId, fromStatus: order.status, toStatus: status, metadata: { driverId } } });
      return { order: await this.storeChange(tx, orderId, correlationId), remainingPickups: remaining };
    });
    this.changed(result.order);
    return { remainingPickups: result.remainingPickups, status: result.order.status };
  }

  async rate(customerId: string, orderId: string, dto: RatingDto) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, customerId, status: 'DELIVERED' } });
    if (!order) throw new BadRequestException('Solo puedes calificar un pedido entregado propio');
    return this.prisma.rating.create({ data: { orderId, customerId, driverId: order.assignedDriverId, score: dto.score, comment: dto.comment } });
  }

  async dispatchPending() {
    if (this.dispatching) return;
    this.dispatching = true;
    try {
      const candidates = await this.prisma.order.findMany({ where: { OR: [{ status: 'SEARCHING_DRIVER', assignedDriverId: null }, { type: 'PERSONAL_SHIPMENT', status: 'CONFIRMED' }] }, include: detailInclude, orderBy: { updatedAt: 'asc' }, take: 30 });
      for (let order of candidates) {
        try {
          if (order.type === 'PERSONAL_SHIPMENT') {
            await requireLegal(order.customerId, ['SHIPPING_TERMS', 'PROHIBITED_ITEMS_POLICY']);
            const policy = await this.prisma.itemPolicy.findUnique({ where: { category: order.shipment!.packageCategory } });
            if (!policy?.isActive || policy.status === 'PROHIBITED' || !['NOT_REQUIRED', 'APPROVED'].includes(order.shipment!.reviewStatus)) continue;
            if (order.status === 'CONFIRMED') {
              const updated = await this.prisma.$transaction(async tx => {
                const claimed = await tx.order.updateMany({ where: { id: order.id, status: 'CONFIRMED', version: order.version }, data: { status: 'SEARCHING_DRIVER', version: { increment: 1 } } });
                if (!claimed.count) return null;
                await tx.orderStatusHistory.create({ data: { orderId: order.id, fromStatus: 'CONFIRMED', toStatus: 'SEARCHING_DRIVER' } });
                return this.storeChange(tx, order.id);
              });
              if (!updated) continue;
              order = updated;
              this.changed(order);
            }
          }
          await internalRequest('drivers', '/internal/assignments/offer', {
            orderId: order.id,
            pickupPoints: order.shipment ? [{ merchantId: order.id, name: 'Recogida de envío personal', latitude: Number(order.shipment.pickupLatitude), longitude: Number(order.shipment.pickupLongitude) }] : order.subOrders.map(sub => ({ merchantId: sub.merchantId, name: sub.merchant.name, latitude: Number(sub.merchant.latitude), longitude: Number(sub.merchant.longitude) })),
            destination: { address: order.deliveryAddress, latitude: Number(order.deliveryLatitude), longitude: Number(order.deliveryLongitude) },
            estimatedEarnings: Number(order.deliveryFee), ...(order.shipment ? { vehicleTypes: [order.shipment.vehicleType] } : {}),
          });
          await this.prisma.order.updateMany({ where: { id: order.id, status: 'SEARCHING_DRIVER' }, data: { updatedAt: new Date() } });
        } catch { /* Persisted SEARCHING_DRIVER is retried after outages; never assign from a mock. */ }
      }
    } finally { this.dispatching = false; }
  }

  private async storeChange(tx: Prisma.TransactionClient, id: string, correlationId?: string) {
    const order = await tx.order.findUniqueOrThrow({ where: { id }, include: detailInclude });
    await this.events.enqueue(tx, `order.${order.status.toLowerCase()}`, { orderId: order.id, customerId: order.customerId, status: order.status }, correlationId);
    return order;
  }

  private changed(order: Detail) {
    this.gateway.emitOrder({ id: order.id, customerId: order.customerId, status: order.status }, order.subOrders.map(sub => sub.merchant.ownerUserId));
  }

  private async orderDetail(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: detailInclude });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    return order;
  }
}
