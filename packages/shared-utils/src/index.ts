import { OrderStatus } from '@delivereats/shared-types';

const transitions: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [
    OrderStatus.SEARCHING_DRIVER,
    OrderStatus.PREPARING,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.SEARCHING_DRIVER]: [OrderStatus.ASSIGNED, OrderStatus.CANCELLED],
  [OrderStatus.ASSIGNED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY_FOR_PICKUP, OrderStatus.CANCELLED],
  [OrderStatus.READY_FOR_PICKUP]: [OrderStatus.PICKING_UP, OrderStatus.CANCELLED],
  [OrderStatus.PICKING_UP]: [OrderStatus.ON_THE_WAY, OrderStatus.CANCELLED],
  [OrderStatus.ON_THE_WAY]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return transitions[from]?.includes(to) ?? false;
}

export type CheckoutInput = {
  itemTotals: number[];
  promotion?: {
    type: 'PERCENTAGE' | 'FIXED' | 'FREE_DELIVERY';
    value: number;
    maximumDiscount?: number | null;
  };
  deliveryFee?: number;
  serviceRate?: number;
};

export type CheckoutTotals = {
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  total: number;
};

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateCheckout(input: CheckoutInput): CheckoutTotals {
  const subtotal = money(input.itemTotals.reduce((sum, current) => sum + current, 0));
  const deliveryFee = money(input.deliveryFee ?? 5);
  const serviceFee = money(subtotal * (input.serviceRate ?? 0.05));
  let discount = 0;
  if (input.promotion?.type === 'PERCENTAGE') {
    discount = subtotal * (input.promotion.value / 100);
  } else if (input.promotion?.type === 'FIXED') {
    discount = input.promotion.value;
  } else if (input.promotion?.type === 'FREE_DELIVERY') {
    discount = deliveryFee;
  }
  if (input.promotion?.maximumDiscount != null) {
    discount = Math.min(discount, input.promotion.maximumDiscount);
  }
  discount = money(Math.min(discount, subtotal + deliveryFee));
  return {
    subtotal,
    deliveryFee,
    serviceFee,
    discount,
    total: money(subtotal + deliveryFee + serviceFee - discount),
  };
}

export function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const sinLatitude = Math.sin(latitudeDelta / 2);
  const sinLongitude = Math.sin(longitudeDelta / 2);
  const value =
    sinLatitude ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * sinLongitude ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function generateOrderNumber(sequence: number, date = new Date()): string {
  return `AYA-${date.getUTCFullYear()}-${sequence.toString().padStart(6, '0')}`;
}
