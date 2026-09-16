import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import Redis from 'ioredis';
import type { DriverLocation } from '@delivereats/shared-types';

@Injectable()
export class TrackingStore implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrackingStore.name);
  private redis?: Redis;
  async onModuleInit() {
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 2_000, enableOfflineQueue: false });
    this.redis.on('error', () => this.logger.warn('Redis de seguimiento no disponible'));
    await this.redis.connect().catch(() => undefined);
  }
  async set(location: DriverLocation): Promise<boolean> {
    if (this.redis?.status !== 'ready') throw new ServiceUnavailableException('Seguimiento temporalmente sin conexión; conserva el buffer local');
    const timestamp = new Date(location.timestamp).getTime();
    // Old buffered points must never resurrect a stale position or overwrite a newer sample.
    if (timestamp < Date.now() - 30_000) return false;
    const result = await this.redis.eval(`
      local previous = tonumber(redis.call('GET', KEYS[2]) or '0')
      if tonumber(ARGV[1]) <= previous then return 0 end
      redis.call('SET', KEYS[2], ARGV[1], 'EX', 600)
      redis.call('SET', KEYS[1], ARGV[2], 'EX', 30)
      return 1
    `, 2, `driver:${location.driverId}:location`, `driver:${location.driverId}:location-ts`, timestamp, JSON.stringify(location));
    return result === 1;
  }
  async get(driverId: string): Promise<DriverLocation | null> {
    if (this.redis?.status !== 'ready') throw new ServiceUnavailableException('Seguimiento temporalmente sin conexión');
    const raw = await this.redis.get(`driver:${driverId}:location`);
    if (!raw) return null;
    const location = JSON.parse(raw) as DriverLocation;
    return new Date(location.timestamp).getTime() < Date.now() - 30_000 ? null : location;
  }
  async ping(): Promise<'ok' | 'degraded'> {
    return this.redis?.status === 'ready' && (await this.redis.ping().catch(() => '')) === 'PONG' ? 'ok' : 'degraded';
  }
  async onModuleDestroy() { if (this.redis) await this.redis.quit().catch(() => undefined); }
}
