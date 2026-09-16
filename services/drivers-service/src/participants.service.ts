import { ForbiddenException, Injectable } from '@nestjs/common';
import { internalRequest } from '@delivereats/backend-kit';
import { type JwtPayload, UserRole } from '@delivereats/shared-types';
import { PrismaService } from './prisma.service';

export type OrderContext = { id: string; customerId: string; assignedDriverId: string | null; status: string; type: string; completedAt: string | null; cancelledAt: string | null };

@Injectable()
export class ParticipantsService {
  constructor(private readonly prisma: PrismaService) {}
  context(orderId: string) { return internalRequest<OrderContext>('orders', `/internal/orders/${orderId}/context`); }
  async require(user: Pick<JwtPayload, 'sub' | 'role'>, orderId: string, allowAdmin = false, operational = true) {
    const order = await this.context(orderId);
    if (!order.assignedDriverId) throw new ForbiddenException('El pedido aún no tiene repartidor asignado');
    const driver = await this.prisma.driverProfile.findUnique({ where: { id: order.assignedDriverId }, select: { id: true, userId: true, rating: true, vehicleType: true, vehiclePlate: true } });
    if (!driver) throw new ForbiddenException('Repartidor no disponible');
    const allowed = (user.role === UserRole.CUSTOMER && user.sub === order.customerId) || (user.role === UserRole.DRIVER && user.sub === driver.userId) || (allowAdmin && user.role === UserRole.ADMIN);
    if (!allowed) throw new ForbiddenException('No participas en este pedido');
    const grace = Math.min(60, Math.max(0, Number(process.env.COMMUNICATION_GRACE_MINUTES ?? 15))) * 60_000;
    const active = ['ASSIGNED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKING_UP', 'ON_THE_WAY'].includes(order.status);
    const recent = order.status === 'DELIVERED' && order.completedAt && Date.now() - new Date(order.completedAt).getTime() < grace;
    if (operational && !active && !recent) throw new ForbiddenException('Finalizó la ventana de comunicación de este pedido');
    return { order, driver, counterpartId: user.sub === order.customerId ? driver.userId : order.customerId };
  }
}
