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
      const active = await tx.driverAssignment.count({ where: { driver: { userId }, status: { in: ['OFFERED', 'ACCEPTED'] } } });
      if (active) throw new ConflictException('El repartidor tiene una oferta o entrega activa; resuélvela antes de la baja');
      await tx.driverProfile.updateMany({ where: { userId }, data: { status: 'OFFLINE', applicationStatus: 'SUSPENDED', currentLatitude: null, currentLongitude: null, lastLocationAt: null, version: { increment: 1 } } });
      return { deactivated: true };
    }, { isolationLevel: 'Serializable' });
  }
  @Get(':userId')
  async export(@Headers('x-internal-service-secret') secret: string, @Param('userId', ParseUUIDPipe) userId: string) {
    authorizeInternal(secret);
    const [profile, messages, calls] = await Promise.all([
      this.prisma.driverProfile.findUnique({ where: { userId }, omit: { reviewedBy: true }, include: { assignments: true, locationSamples: true } }),
      this.prisma.message.findMany({ where: { OR: [{ senderUserId: userId }, { recipientUserId: userId }] }, select: { id: true, body: true, createdAt: true, readAt: true, senderUserId: true, conversation: { select: { orderId: true } } } }),
      this.prisma.callSession.findMany({ where: { OR: [{ callerUserId: userId }, { calleeUserId: userId }] }, select: { id: true, orderId: true, status: true, startedAt: true, endedAt: true, callerUserId: true } }),
    ]);
    return { profile, messages: messages.map(({ senderUserId, ...message }) => ({ ...message, sentByMe: senderUserId === userId })), calls: calls.map(({ callerUserId, ...call }) => ({ ...call, startedByMe: callerUserId === userId })) };
  }
}
