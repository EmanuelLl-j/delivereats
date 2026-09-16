import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  Prisma,
} from './generated/prisma';
import { CreateNotificationDto, RegisterDeviceDto } from './dto';
import { ConfigurablePushProvider, SmtpEmailProvider } from './providers';
import { PrismaService } from './prisma.service';
import { internalRequest } from '@delivereats/backend-kit';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: SmtpEmailProvider,
    private readonly push: ConfigurablePushProvider,
  ) {}

  list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId, channel: { not: NotificationChannel.PUSH } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  listAll() {
    return this.prisma.notification.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async unreadCount(userId: string) {
    return { count: await this.prisma.notification.count({ where: { userId, readAt: null, channel: { not: NotificationChannel.PUSH } } }) };
  }

  async markRead(userId: string, id: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
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
      data: { readAt: new Date() },
    });
    return { success: true, count: result.count };
  }

  async registerDevice(userId: string, authVersion: number, dto: RegisterDeviceDto) {
    if (dto.platform !== 'android') throw new ServiceUnavailableException('Este proveedor requiere un token FCM Android; los tokens APNs o Expo no son tokens Firebase');
    await this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      create: { userId, token: dto.token, platform: dto.platform, authVersion },
      update: { userId, platform: dto.platform, active: true, authVersion },
    });
    return { registered: true };
  }

  async unregisterDevice(userId: string, token: string) {
    await this.prisma.deviceToken.updateMany({ where: { userId, token }, data: { active: false } });
    return { registered: false };
  }

  create(dto: CreateNotificationDto, eventId?: string) {
    return this.createAndDeliver({ ...dto, eventId });
  }

  async pushDomainEvent(input: { userId: string; type: NotificationType; title: string; message: string; data?: Record<string, unknown>; eventId: string }) {
    // No fake success or failed push records when this optional provider is off.
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return;
    const state = await internalRequest<{ status: string; authVersion: number }>('users', `/internal/users/${input.userId}/auth-state`);
    if (state.status !== 'ACTIVE') return;
    const devices = await this.prisma.deviceToken.count({ where: { userId: input.userId, active: true, authVersion: state.authVersion, platform: 'android' } });
    if (!devices) return;
    await this.createAndDeliver({ ...input, channel: NotificationChannel.PUSH, eventId: input.eventId + ':push' });
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
    const security = input.type === NotificationType.SECURITY;
    const safeData = security ? undefined : input.data ? Object.fromEntries(['orderId', 'status', 'type'].filter(key => key in input.data!).map(key => [key, input.data![key]])) as Prisma.InputJsonValue : undefined;
    const data = {
      userId: input.userId, type: input.type, channel: input.channel, title: input.title,
      message: security ? 'Recibiste una comunicación de seguridad en tu correo. No compartas los códigos.' : input.message,
      data: safeData, eventId: input.eventId,
    };
    try {
      return await this.prisma.$transaction(async tx => {
        if (input.eventId) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.eventId}))`;
        const existing = input.eventId ? await tx.notification.findUnique({ where: { eventId: input.eventId } }) : null;
        if (existing && ['SENT', 'READ'].includes(existing.status)) return existing;
        const notification = existing ?? await tx.notification.create({ data });
        if (input.channel === NotificationChannel.EMAIL) {
          if (!input.email) throw new ServiceUnavailableException('El evento no incluye destinatario de correo');
          await this.email.send(input.email, input.title, input.message);
        } else if (input.channel === NotificationChannel.PUSH) {
          const state = await internalRequest<{ status: string; authVersion: number }>('users', `/internal/users/${input.userId}/auth-state`);
          if (state.status !== 'ACTIVE') throw new ServiceUnavailableException('La cuenta no está activa para recibir notificaciones');
          const devices = await tx.deviceToken.findMany({ where: { userId: input.userId, active: true, authVersion: state.authVersion, platform: 'android' } });
          const pushData = safeData ? Object.fromEntries(Object.entries(safeData).filter(([, value]) => typeof value === 'string').map(([key, value]) => [key, String(value)])) : undefined;
          await this.push.send(devices.map(item => item.token), input.title, input.message, pushData);
        } else if (input.channel !== NotificationChannel.IN_APP) {
          throw new ServiceUnavailableException('Canal de notificación no configurado');
        }
        return tx.notification.update({ where: { id: notification.id }, data: { status: NotificationStatus.SENT, sentAt: new Date(), failureReason: null } });
      }, { maxWait: 20_000, timeout: 30_000 });
    } catch (error) {
      if (input.eventId) {
        await this.prisma.notification.upsert({ where: { eventId: input.eventId },
          create: { ...data, status: NotificationStatus.FAILED, failureReason: 'DELIVERY_FAILED' },
          update: {},
        });
        // Do not overwrite a successfully delivered concurrent retry.
        await this.prisma.notification.updateMany({ where: { eventId: input.eventId, status: { in: ['PENDING', 'FAILED'] } }, data: { status: NotificationStatus.FAILED, failureReason: 'DELIVERY_FAILED' } });
      }
      throw error;
    }
  }
}
