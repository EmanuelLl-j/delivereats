import { describe, expect, it } from 'vitest';
import { OrderStatus } from '@delivereats/shared-types';
import { calculateCheckout, canTransitionOrder, generateOrderNumber, haversineKm } from './index';

describe('shared domain utilities', () => {
  it('calculates the documented PDGP10 example on the server', () => {
    expect(
      calculateCheckout({ itemTotals: [42, 45], promotion: { type: 'PERCENTAGE', value: 10 } }),
    ).toEqual({
      subtotal: 87,
      deliveryFee: 5,
      serviceFee: 4.35,
      discount: 8.7,
      total: 87.65,
    });
  });

  it('allows only valid order transitions', () => {
    expect(canTransitionOrder(OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP)).toBe(true);
    expect(canTransitionOrder(OrderStatus.DELIVERED, OrderStatus.PENDING)).toBe(false);
  });

  it('creates readable Ayacucho numbers', () => {
    expect(generateOrderNumber(1, new Date('2026-01-10T00:00:00Z'))).toBe('AYA-2026-000001');
  });

  it('calculates local distance with Haversine', () => {
    const distance = haversineKm(
      { latitude: -13.1588, longitude: -74.2236 },
      { latitude: -13.165, longitude: -74.228 },
    );
    expect(distance).toBeGreaterThan(0.5);
    expect(distance).toBeLessThan(1.5);
  });
});
