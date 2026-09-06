import { Injectable, NotFoundException } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  Prisma,
} from './generated/prisma';
import { CreateNotificationDto, RegisterDeviceDto } from './dto';
import { ConfigurablePushProvider, SmtpEmailProvider } from './providers';
import { PrismaService } from './prisma.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: SmtpEmailProvider,
    private readonly push: ConfigurablePushProvider,
  ) {}

  list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  listAll() {
    return this.prisma.notification.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async unreadCount(userId: string) {
    return { count: await this.prisma.notification.count({ where: { userId, readAt: null } }) };
  }

  async markRead(userId: string, id: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date(), status: NotificationStatus.READ },
    });
    if (!result.count)
      throw new NotFoundException({
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'Notificación no encontrada',
      });
    return { success: true };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date(), status: NotificationStatus.READ },
    });
    return { success: true, count: result.count };
  }

  registerDevice(userId: string, dto: RegisterDeviceDto) {
    return this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      create: { userId, token: dto.token, platform: dto.platform },
      update: { userId, platform: dto.platform, active: true },
    });
  }

  create(dto: CreateNotificationDto, eventId?: string) {
    return this.createAndDeliver({ ...dto, eventId });
  }

  async createAndDeliver(input: {
    userId: string;
    type: NotificationType;
    channel: NotificationChannel;
    title: string;
    message: string;
    data?: Record<string, unknown>;
    eventId?: string;
    email?: string;
  }) {
    if (input.eventId) {
      const existing = await this.prisma.notification.findUnique({
        where: { eventId: input.eventId },
      });
      if (existing) return existing;
    }
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        channel: input.channel,
        title: input.title,
        message: input.message,
        data: input.data as Prisma.InputJsonValue | undefined,
        eventId: input.eventId,
      },
    });
    try {
      if (input.channel === NotificationChannel.EMAIL && input.email) {
        await this.email.send(input.email, input.title, input.message);
      }
      if (input.channel === NotificationChannel.PUSH) {
        const devices = await this.prisma.deviceToken.findMany({
          where: { userId: input.userId, active: true },
        });
        await this.push.send(
          devices.map((item) => item.token),
          input.title,
          input.message,
        );
      }
      return this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.SENT, sentAt: new Date() },
      });
    } catch (error) {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.FAILED, failureReason: String(error).slice(0, 500) },
      });
      throw error;
    }
  }
}
