import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import type { DriverLocation } from '@delivereats/shared-types';

@Injectable()
export class TrackingStore implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrackingStore.name);
  private readonly memory = new Map<string, { value: DriverLocation; expiresAt: number }>();
  private redis?: Redis;

  async onModuleInit(): Promise<void> {
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
      enableOfflineQueue: false,
    });
    await this.redis.connect().catch((error: unknown) => {
      this.logger.warn(`Redis no disponible; tracking temporal en memoria: ${String(error)}`);
    });
  }

  async set(location: DriverLocation): Promise<void> {
    this.memory.set(location.driverId, { value: location, expiresAt: Date.now() + 30_000 });
    if (this.redis?.status === 'ready') {
      await this.redis
        .set(`driver:${location.driverId}:location`, JSON.stringify(location), 'EX', 30)
        .catch(() => undefined);
    }
  }

  async get(driverId: string): Promise<DriverLocation | null> {
    if (this.redis?.status === 'ready') {
      const raw = await this.redis.get(`driver:${driverId}:location`).catch(() => null);
      if (raw) return JSON.parse(raw) as DriverLocation;
    }
    const cached = this.memory.get(driverId);
    if (!cached || cached.expiresAt < Date.now()) return null;
    return cached.value;
  }

  async ping(): Promise<'ok' | 'degraded'> {
    if (this.redis?.status !== 'ready') return 'degraded';
    return (await this.redis.ping().catch(() => '')) === 'PONG' ? 'ok' : 'degraded';
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) await this.redis.quit().catch(() => undefined);
  }
}
