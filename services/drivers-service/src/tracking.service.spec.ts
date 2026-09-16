import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { TrackingStore } from './tracking.service';

describe('TrackingStore', () => {
  const location = () => ({ driverId: randomUUID(), latitude: -13.1588, longitude: -74.2236, speed: 31, timestamp: new Date().toISOString() });
  it('fails explicitly when Redis is unavailable so the app can buffer', async () => {
    const store = new TrackingStore();
    await expect(store.set(location())).rejects.toThrow('buffer local');
    expect(await store.ping()).toBe('degraded');
  });
  it('uses atomic timestamp comparison with a 30-second location TTL', async () => {
    const store = new TrackingStore();
    const redis = { status: 'ready', eval: vi.fn(async () => 1) };
    Object.assign(store, { redis });
    expect(await store.set(location())).toBe(true);
    expect(redis.eval).toHaveBeenCalledWith(expect.stringContaining("'EX', 30"), 2, expect.any(String), expect.any(String), expect.any(Number), expect.any(String));
  });
  it('does not publish stale buffered samples', async () => {
    const store = new TrackingStore();
    const redis = { status: 'ready', eval: vi.fn() };
    Object.assign(store, { redis });
    expect(await store.set({ ...location(), timestamp: new Date(Date.now() - 60_000).toISOString() })).toBe(false);
    expect(redis.eval).not.toHaveBeenCalled();
  });
  it('suppresses duplicates rejected by the Redis high-water timestamp', async () => {
    const store = new TrackingStore();
    Object.assign(store, { redis: { status: 'ready', eval: vi.fn(async () => 0) } });
    expect(await store.set(location())).toBe(false);
  });
});
