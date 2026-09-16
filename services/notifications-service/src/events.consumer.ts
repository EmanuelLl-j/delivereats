import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NotificationChannel, NotificationType } from './generated/prisma';
import amqp, { type ChannelModel, type ConfirmChannel, type ConsumeMessage } from 'amqplib';
import type { EventEnvelope } from '@delivereats/shared-types';
import { NotificationsService } from './notifications.service';

type NotificationInput = {
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  email?: string;
};

const titles: Record<string, { title: string; message: string; type: NotificationType }> = {
  'chat.message': { title: 'Nuevo mensaje de entrega', message: 'Abre el chat del pedido para leer el mensaje.', type: NotificationType.ORDER },
  'call.ringing': { title: 'Llamada de entrega', message: 'Abre el chat del pedido para responder si la llamada sigue vigente.', type: NotificationType.ORDER },
  'driver.accepted': { title: 'Entrega aceptada', message: 'Consulta los puntos de recogida de tu entrega.', type: NotificationType.DRIVER },
  'order.searching_driver': { title: 'Buscando repartidor', message: 'La asignación está en curso. Puedes consultar el estado del pedido.', type: NotificationType.ORDER },
  'order.requires_review': { title: 'Envío en revisión', message: 'La descripción del envío requiere revisión administrativa antes de continuar.', type: NotificationType.ORDER },
  'order.created': {
    title: 'Pedido creado',
    message: 'Recibimos tu solicitud. Consulta el pedido para conocer su estado y forma de pago.',
    type: NotificationType.ORDER,
  },
  'order.confirmed': {
    title: 'Pedido confirmado',
    message: 'Tu pedido fue confirmado por DeliverEats.',
    type: NotificationType.ORDER,
  },
  'order.assigned': {
    title: 'Repartidor encontrado',
    message: 'Un repartidor aceptó tu pedido.',
    type: NotificationType.DRIVER,
  },
  'order.preparing': {
    title: 'Preparando tu pedido',
    message: 'Los comercios están preparando tus productos.',
    type: NotificationType.ORDER,
  },
  'order.ready': {
    title: 'Pedido listo',
    message: 'Tu pedido está listo para ser recogido.',
    type: NotificationType.ORDER,
  },
  'order.picked_up': {
    title: 'Recojo confirmado',
    message: 'El repartidor está completando los puntos de recojo.',
    type: NotificationType.ORDER,
  },
  'order.on_the_way': {
    title: 'Pedido en camino',
    message: 'Sigue la ubicación del repartidor en tiempo real.',
    type: NotificationType.ORDER,
  },
  'order.delivered': {
    title: 'Pedido entregado',
    message: 'La entrega ha finalizado. Ya puedes calificarla.',
    type: NotificationType.ORDER,
  },
  'order.cancelled': {
    title: 'Pedido cancelado',
    message: 'El pedido fue cancelado.',
    type: NotificationType.ORDER,
  },
  'payment.approved': {
    title: 'Pago aprobado',
    message: 'El pago fue verificado correctamente.',
    type: NotificationType.PAYMENT,
  },
  'payment.rejected': {
    title: 'Pago rechazado',
    message: 'No pudimos aprobar el pago. Prueba otro método.',
    type: NotificationType.PAYMENT,
  },
  'driver.assigned': {
    title: 'Nueva asignación',
    message: 'Tienes una nueva oferta de pedido.',
    type: NotificationType.DRIVER,
  },
};

export function notificationFromEvent(
  event: EventEnvelope<Record<string, unknown>>,
): NotificationInput | null {
  const payload = event.payload;
  if (event.name === 'notification.requested') {
    const userId = typeof payload.userId === 'string' ? payload.userId : undefined;
    if (!userId) return null;
    return {
      userId,
      type: (payload.type as NotificationType | undefined) ?? NotificationType.SYSTEM,
      channel: (payload.channel as NotificationChannel | undefined) ?? NotificationChannel.IN_APP,
      title: typeof payload.title === 'string' ? payload.title : 'DeliverEats',
      message:
        typeof payload.message === 'string' ? payload.message : 'Tienes una nueva notificación.',
      email: typeof payload.email === 'string' ? payload.email : undefined,
      data: payload,
    };
  }
  const template = titles[event.name];
  if (!template) return null;
  const userId =
    typeof payload.userId === 'string'
      ? payload.userId
      : typeof payload.customerId === 'string'
        ? payload.customerId
        : undefined;
  if (!userId) return null;
  return {
    userId,
    type: template.type,
    channel: NotificationChannel.IN_APP,
    title: template.title,
    message: template.message,
    data: payload,
  };
}

@Injectable()
export class EventsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsConsumer.name);
  private connection?: ChannelModel;
  private channel?: ConfirmChannel;
  private reconnectTimer?: NodeJS.Timeout;
  private connecting = false;
  private stopped = false;

  constructor(private readonly notifications: NotificationsService) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  healthy(): boolean {
    return Boolean(this.channel);
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }

  private async connect(): Promise<void> {
    if (this.stopped || this.connecting || this.channel || process.env.RABBITMQ_ENABLED === 'false') return;
    this.connecting = true;
    try {
      if (!process.env.RABBITMQ_URL) throw new Error('RabbitMQ URL not configured');
      const connection = await amqp.connect(process.env.RABBITMQ_URL, { timeout: 4_000 });
      this.connection = connection;
      connection.on('error', () => this.disconnected(connection));
      connection.on('close', () => this.disconnected(connection));
      const channel = await connection.createConfirmChannel();
      const eventsExchange = 'delivereats.events';
      const retryExchange = 'delivereats.notifications.retry';
      const deadLetterExchange = 'delivereats.dlx';
      const queue = 'notifications.events';
      const retryQueue = 'notifications.retry.5s';
      const deadQueue = 'notifications.dlq';
      await channel.assertExchange(eventsExchange, 'topic', { durable: true });
      await channel.assertExchange(retryExchange, 'direct', { durable: true });
      await channel.assertExchange(deadLetterExchange, 'topic', { durable: true });
      await channel.assertQueue(queue, {
        durable: true,
        arguments: { 'x-dead-letter-exchange': deadLetterExchange },
      });
      await channel.assertQueue(retryQueue, {
        durable: true,
        arguments: {
          'x-message-ttl': 5_000,
          'x-dead-letter-exchange': eventsExchange,
          'x-dead-letter-routing-key': 'notification.retry',
        },
      });
      await channel.assertQueue(deadQueue, { durable: true });
      await channel.bindQueue(queue, eventsExchange, '#');
      await channel.bindQueue(retryQueue, retryExchange, 'retry');
      await channel.bindQueue(deadQueue, deadLetterExchange, '#');
      await channel.prefetch(10);
      this.connection = connection;
      this.channel = channel;
      channel.on('error', () => this.disconnected(connection));
      channel.on('close', () => this.disconnected(connection));
      await channel.consume(queue, (message) => void this.handle(message, channel).catch(() => this.disconnected(connection)), { noAck: false });
      this.logger.log('Consumidor RabbitMQ listo con retry y DLQ');
    } catch {
      this.logger.warn('RabbitMQ no disponible; se reintentará la conexión');
      if (this.connection) this.disconnected(this.connection);
      this.scheduleReconnect();
    } finally {
      this.connecting = false;
    }
  }

  private async handle(message: ConsumeMessage | null, channel: ConfirmChannel): Promise<void> {
    if (!message) throw new Error('Consumer cancelled');
    try {
      const event = JSON.parse(message.content.toString('utf8')) as EventEnvelope<
        Record<string, unknown>
      >;
      const input = notificationFromEvent(event);
      if (input) {
        await this.notifications.createAndDeliver({ ...input, eventId: event.id });
        if (event.name !== 'notification.requested') await this.notifications.pushDomainEvent({ ...input, eventId: event.id });
      }
      channel.ack(message);
    } catch {
      const retries = Number(message.properties.headers?.['x-retry-count'] ?? 0);
      const headers = { ...message.properties.headers, 'x-retry-count': retries + 1 };
      if (retries < 3) {
        channel.publish('delivereats.notifications.retry', 'retry', message.content, {
          persistent: true,
          contentType: message.properties.contentType,
          messageId: message.properties.messageId,
          headers,
        });
      } else {
        channel.publish('delivereats.dlx', 'notifications.dead', message.content, {
          persistent: true,
          contentType: message.properties.contentType,
          messageId: message.properties.messageId,
          headers: { ...headers, 'x-error': 'DELIVERY_FAILED' },
        });
      }
      await channel.waitForConfirms();
      channel.ack(message);
    }
  }

  private disconnected(connection: ChannelModel): void {
    if (this.connection !== connection) return;
    this.channel = undefined;
    this.connection = undefined;
    void connection.close().catch(() => undefined);
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.connect();
    }, 10_000);
    this.reconnectTimer.unref();
  }
}
