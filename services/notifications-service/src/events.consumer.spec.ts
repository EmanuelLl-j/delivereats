import { describe, expect, it } from 'vitest';
import { NotificationChannel, NotificationType } from './generated/prisma';
import { notificationFromEvent } from './events.consumer';

describe('RabbitMQ notification mapping', () => {
  it('maps order events into idempotent in-app messages', () => {
    const result = notificationFromEvent({
      id: 'event-1',
      name: 'order.on_the_way',
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId: 'correlation',
      payload: { customerId: '11111111-1111-4111-8111-111111111111', orderId: 'order' },
    });
    expect(result).toMatchObject({
      userId: '11111111-1111-4111-8111-111111111111',
      type: NotificationType.ORDER,
      channel: NotificationChannel.IN_APP,
    });
  });

  it('preserves requested email channel and recipient', () => {
    const result = notificationFromEvent({
      id: 'event-2',
      name: 'notification.requested',
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId: 'correlation',
      payload: {
        userId: '11111111-1111-4111-8111-111111111111',
        channel: 'EMAIL',
        title: 'Seguridad',
        message: 'Recupera tu cuenta',
        email: 'cliente@delivereats.local',
      },
    });
    expect(result?.channel).toBe(NotificationChannel.EMAIL);
    expect(result?.email).toBe('cliente@delivereats.local');
  });
});
