import { describe, expect, it } from 'vitest';
import { OrderStatus } from '@delivereats/shared-types';
import { calculateCheckout, canTransitionOrder } from '@delivereats/shared-utils';

describe('orders domain', () => {
  it('never trusts client totals and reproduces the PDGP10 example', () => {
    expect(
      calculateCheckout({
        itemTotals: [42, 45],
        promotion: { type: 'PERCENTAGE', value: 10, maximumDiscount: 25 },
      }),
    ).toEqual({ subtotal: 87, deliveryFee: 5, serviceFee: 4.35, discount: 8.7, total: 87.65 });
  });

  it('rejects arbitrary state changes', () => {
    expect(canTransitionOrder(OrderStatus.PENDING, OrderStatus.DELIVERED)).toBe(false);
    expect(canTransitionOrder(OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP)).toBe(true);
  });
});
