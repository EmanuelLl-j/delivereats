import { ConflictException, Controller, Get, Headers, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { authorizeInternal, Public } from '@delivereats/backend-kit';
import { PrismaService } from './prisma.service';

@Public()
@SkipThrottle()
@Controller('internal/privacy')
export class InternalPrivacyController {
  constructor(private readonly prisma: PrismaService) {}
  @Post(':userId/deactivate')
  async deactivate(@Headers('x-internal-service-secret') secret: string, @Param('userId', ParseUUIDPipe) userId: string) {
    authorizeInternal(secret);
    return this.prisma.$transaction(async tx => {
      const active = await tx.order.count({ where: { status: { notIn: ['DELIVERED', 'CANCELLED'] }, OR: [{ customerId: userId }, { subOrders: { some: { merchant: { ownerUserId: userId } } } }] } });
      if (active) throw new ConflictException('Hay pedidos o envíos activos; deben resolverse antes de la baja');
      await tx.merchant.updateMany({ where: { ownerUserId: userId }, data: { isActive: false, isOpen: false } });
      return { deactivated: true };
    }, { isolationLevel: 'Serializable' });
  }
  @Get(':userId')
  async export(@Headers('x-internal-service-secret') secret: string, @Param('userId', ParseUUIDPipe) userId: string) {
    authorizeInternal(secret);
    const [orders, merchants, subOrders, ratings, refunds] = await Promise.all([
      this.prisma.order.findMany({ where: { customerId: userId }, omit: { version: true }, include: { subOrders: { include: { items: true } }, shipment: { omit: { pickupVerificationCode: true, deliveryVerificationCode: true, verificationAttempts: true, verificationLockedUntil: true, declarationEvidence: true, reviewedBy: true } }, payments: { select: { id: true, amount: true, method: true, provider: true, status: true, createdAt: true, verifiedAt: true } } } }),
      this.prisma.merchant.findMany({ where: { ownerUserId: userId }, include: { categories: { include: { products: true } } } }),
      this.prisma.subOrder.findMany({ where: { merchant: { ownerUserId: userId } }, include: { items: true } }),
      this.prisma.rating.findMany({ where: { customerId: userId } }),
      this.prisma.refund.findMany({ where: { order: { customerId: userId } }, select: { id: true, orderId: true, amount: true, reason: true, status: true, createdAt: true } }),
    ]);
    return { orders, merchants, subOrders, ratings, refunds };
  }
}
