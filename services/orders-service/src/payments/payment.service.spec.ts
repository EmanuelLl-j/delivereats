import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderStatus, PaymentProvider, PaymentStatus } from '../generated/prisma';
import { PaymentService } from './payment.service';

describe('PaymentService mock provider', () => {
  const intent = { id: 'payment-1', orderId: 'order-1', provider: PaymentProvider.MOCK };
  const order = { id: 'order-1', customerId: 'customer-1', status: OrderStatus.PENDING };
  let events: { publish: ReturnType<typeof vi.fn> };
  let service: PaymentService;

  beforeEach(() => {
    process.env.PAYMENTS_MODE = 'mock';
    events = { publish: vi.fn(async () => true) };
    const tx = {
      paymentIntent: { update: vi.fn(async () => ({ ...intent, status: PaymentStatus.APPROVED })) },
      order: {
        findUniqueOrThrow: vi.fn(async () => order),
        update: vi.fn(
          async ({ data }: { data: { status?: OrderStatus; paymentStatus: PaymentStatus } }) => ({
            ...order,
            ...data,
          }),
        ),
      },
      orderStatusHistory: { create: vi.fn(async () => ({})) },
    };
    const prisma = {
      paymentIntent: { findUnique: vi.fn(async () => ({ ...intent, order })) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    service = new PaymentService(prisma as never, events as never);
  });

  it('allows an admin decision only through the mock provider and confirms the order', async () => {
    const result = await service.decideMock(intent.id, true, 'test-correlation');
    expect(result.order.status).toBe(OrderStatus.CONFIRMED);
    expect(result.order.paymentStatus).toBe(PaymentStatus.APPROVED);
    expect(events.publish).toHaveBeenCalledWith(
      'payment.approved',
      expect.objectContaining({ orderId: order.id }),
      'test-correlation',
    );
    expect(events.publish).toHaveBeenCalledWith(
      'order.confirmed',
      expect.objectContaining({ orderId: order.id }),
      'test-correlation',
    );
  });
});
