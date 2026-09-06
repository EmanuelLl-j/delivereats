import { describe, expect, it } from 'vitest';
import { TrackingStore } from './tracking.service';

describe('TrackingStore', () => {
  it('keeps a fresh location in the in-memory fallback when Redis is unavailable', async () => {
    const store = new TrackingStore();
    const location = {
      driverId: 'driver-1',
      latitude: -13.1588,
      longitude: -74.2236,
      speed: 31,
      timestamp: '2026-08-23T20:00:00.000Z',
    };
    await store.set(location);
    expect(await store.get(location.driverId)).toEqual(location);
    expect(await store.ping()).toBe('degraded');
  });
});
