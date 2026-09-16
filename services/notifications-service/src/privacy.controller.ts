import { Controller, Get, Headers, Param, ParseUUIDPipe, Post } from '@nestjs/common';
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
    await this.prisma.deviceToken.updateMany({ where: { userId }, data: { active: false } });
    return { deactivated: true };
  }
  @Get(':userId')
  async export(@Headers('x-internal-service-secret') secret: string, @Param('userId', ParseUUIDPipe) userId: string) {
    authorizeInternal(secret);
    const [notifications, devices] = await Promise.all([
      this.prisma.notification.findMany({ where: { userId }, omit: { eventId: true } }),
      this.prisma.deviceToken.findMany({ where: { userId }, select: { platform: true, active: true, createdAt: true, updatedAt: true } }),
    ]);
    return { notifications, devices };
  }
}
