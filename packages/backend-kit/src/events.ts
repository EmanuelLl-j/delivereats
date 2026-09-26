import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional, ServiceUnavailableException } from '@nestjs/common';
import * as amqp from 'amqplib';
import type { ChannelModel, ConfirmChannel } from 'amqplib';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import type { EventEnvelope } from '@delivereats/shared-types';

type OutboxRow = { id: string; name: string; payload: string; correlationId: string };

function rabbitFailureCategory(error: unknown): string {
  const candidate = error as { code?: unknown; message?: unknown } | null;
  const code = typeof candidate?.code === 'string' ? candidate.code.toUpperCase() : '';
  const message = typeof candidate?.message === 'string' ? candidate.message.toUpperCase() : '';
  const details = `${code} ${message}`;
  if (/ENOTFOUND|EAI_AGAIN|DNS/.test(details)) return 'DNS_FAILURE';
  if (/ECONNREFUSED/.test(details)) return 'CONNECTION_REFUSED';
  if (/ETIMEDOUT|TIMEOUT/.test(details)) return 'CONNECTION_TIMEOUT';
  if (/ACCESS_REFUSED|AUTHENTICATION|LOGIN WAS REFUSED|NOT ALLOWED/.test(details)) return 'AUTHENTICATION_OR_VHOST';
  if (/PRECONDITION_FAILED|INEQUIVALENT ARG/.test(details)) return 'BROKER_TOPOLOGY_CONFLICT';
  if (/TLS|SSL|CERTIFICATE|HANDSHAKE/.test(details)) return 'TLS_FAILURE';
  return code ? `CONNECTION_FAILURE_${code.replace(/[^A-Z0-9_-]/g, '').slice(0, 32)}` : 'CONNECTION_FAILURE';
}

export interface OutboxStore {
  eventOutbox: {
    create(input: { data: OutboxRow }): Promise<unknown>;
    findMany(input: { where: { publishedAt: null }; orderBy: { createdAt: 'asc' }; take: number }): Promise<OutboxRow[]>;
    updateMany(input: { where: { id: string; publishedAt: null }; data: { publishedAt?: Date; attempts: { increment: number }; lastError: string | null } }): Promise<unknown>;
  };
}

function encryptionKey() {
  const secret = process.env.EVENTS_ENCRYPTION_KEY ?? process.env.INTERNAL_SERVICE_SECRET;
  if (!secret || secret.length < 32) throw new ServiceUnavailableException('Configura una clave segura para los eventos internos');
  return createHash('sha256').update(secret).digest();
}
function seal(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map(buffer => buffer.toString('base64url')).join('.');
}
function unseal(value: string) {
  const [iv, tag, body] = value.split('.').map(part => Buffer.from(part, 'base64url'));
  if (!iv || !tag || !body) throw new Error('Invalid event envelope');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]);
}

@Injectable()
export class EventPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventPublisher.name);
  private connection?: ChannelModel;
  private channel?: ConfirmChannel;
  private timer?: NodeJS.Timeout;
  private running = false;
  private stopped = false;
  constructor(@Optional() @Inject('EVENT_OUTBOX') private readonly store?: OutboxStore) {}
  async onModuleInit() {
    await this.flush();
    this.timer = setInterval(() => void this.flush().catch(() => undefined), 5_000);
    this.timer.unref();
  }
  healthy() { return Boolean(this.channel); }

  async enqueue<T extends Record<string, unknown>>(store: Pick<OutboxStore, 'eventOutbox'>, name: string, payload: T, correlationId: string = randomUUID()) {
    const envelope: EventEnvelope<T> = { id: randomUUID(), name, version: 1, occurredAt: new Date().toISOString(), correlationId, payload };
    await store.eventOutbox.create({ data: { id: envelope.id, name, correlationId, payload: seal(JSON.stringify(envelope)) } });
    return envelope.id;
  }
  async publish<T extends Record<string, unknown>>(name: string, payload: T, correlationId: string = randomUUID()): Promise<boolean> {
    if (!this.store) throw new ServiceUnavailableException('No hay persistencia de eventos configurada');
    await this.enqueue(this.store, name, payload, correlationId);
    void this.flush().catch(() => undefined);
    return true;
  }

  async flush() {
    if (this.running || this.stopped || process.env.RABBITMQ_ENABLED === 'false') return;
    this.running = true;
    try {
      if (!this.channel) {
        if (!process.env.RABBITMQ_URL) return;
        // Se usa amqp.connect gracias al comodín de importación
        const connection = await amqp.connect(process.env.RABBITMQ_URL, { timeout: 4_000 });
        this.connection = connection;
        const disconnected = () => {
          if (this.connection !== connection) return;
          this.channel = undefined;
          this.connection = undefined;
          void connection.close().catch(() => undefined);
        };
        connection.on('error', disconnected);
        connection.on('close', disconnected);
        const channel = await connection.createConfirmChannel();
        await channel.assertExchange('delivereats.events', 'topic', { durable: true });
        await channel.assertExchange('delivereats.dlx', 'topic', { durable: true });
        await channel.assertQueue('notifications.events', { durable: true, arguments: { 'x-dead-letter-exchange': 'delivereats.dlx' } });
        await channel.bindQueue('notifications.events', 'delivereats.events', '#');
        channel.on('error', disconnected);
        channel.on('close', disconnected);
        this.channel = channel;
      }
      if (!this.store) return;
      const pending = await this.store.eventOutbox.findMany({ where: { publishedAt: null }, orderBy: { createdAt: 'asc' }, take: 100 });
      for (const event of pending) {
        const channel = this.channel;
        if (!channel) break;
        try {
          await new Promise<void>((resolve, reject) => {
            channel.publish('delivereats.events', event.name, unseal(event.payload), { persistent: true, contentType: 'application/json', messageId: event.id, correlationId: event.correlationId }, error => error ? reject(error) : resolve());
          });
          await this.store.eventOutbox.updateMany({ where: { id: event.id, publishedAt: null }, data: { publishedAt: new Date(), attempts: { increment: 1 }, lastError: null } });
        } catch {
          await this.store.eventOutbox.updateMany({ where: { id: event.id, publishedAt: null }, data: { attempts: { increment: 1 }, lastError: 'PUBLISH_FAILED' } });
          break;
        }
      }
    } catch (error) {
      // Log only a fixed category. Error messages from AMQP libraries can contain connection details.
      this.logger.warn(`Publicación temporalmente no disponible (${rabbitFailureCategory(error)}); los eventos persisten en outbox`);
      this.channel = undefined;
      await this.connection?.close().catch(() => undefined);
      this.connection = undefined;
    }
    finally { this.running = false; }
  }
  async onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }
}
