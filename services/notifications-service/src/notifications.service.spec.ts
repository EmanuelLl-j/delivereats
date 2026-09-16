import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationsService } from './notifications.service';
import { NotificationChannel, NotificationType } from './generated/prisma';
import { internalRequest } from '@delivereats/backend-kit';
vi.mock('@delivereats/backend-kit', () => ({ internalRequest: vi.fn() }));
const input = { userId: 'owner', eventId: 'event', type: NotificationType.ORDER, title: 'Entrega', message: 'Estado actualizado', data: { orderId: 'order-id', privateValue: 'never-send' } };
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe('Push operativo opcional y privacidad de la sesión', () => {
  function subject() {
    const prisma = { deviceToken: { count: vi.fn().mockResolvedValue(1) } };
    const service = new NotificationsService(prisma as never, {} as never, {} as never);
    const deliver = vi.spyOn(service, 'createAndDeliver').mockResolvedValue({} as never);
    return { service, prisma, deliver };
  }
  it('no crea éxito ficticio ni registros fallidos sin Firebase', async () => {
    vi.stubEnv('FIREBASE_SERVICE_ACCOUNT_JSON', '');
    const { service, deliver, prisma } = subject();
    await service.pushDomainEvent(input);
    expect(deliver).not.toHaveBeenCalled(); expect(prisma.deviceToken.count).not.toHaveBeenCalled();
  });
  it('usa solo tokens de la versión vigente y una clave idempotente por canal', async () => {
    vi.stubEnv('FIREBASE_SERVICE_ACCOUNT_JSON', '{}');
    vi.mocked(internalRequest).mockResolvedValue({ status: 'ACTIVE', authVersion: 7 });
    const { service, prisma, deliver } = subject();
    await service.pushDomainEvent(input);
    expect(prisma.deviceToken.count).toHaveBeenCalledWith({ where: { userId: 'owner', active: true, authVersion: 7, platform: 'android' } });
    expect(deliver).toHaveBeenCalledWith({ ...input, channel: NotificationChannel.PUSH, eventId: 'event:push' });
  });
  it('no envía a una cuenta suspendida', async () => {
    vi.stubEnv('FIREBASE_SERVICE_ACCOUNT_JSON', '{}');
    vi.mocked(internalRequest).mockResolvedValue({ status: 'SUSPENDED', authVersion: 8 });
    const { service, deliver } = subject();
    await service.pushDomainEvent(input); expect(deliver).not.toHaveBeenCalled();
  });
  it('mantiene pendiente el evento cuando el proveedor falla', async () => {
    vi.stubEnv('FIREBASE_SERVICE_ACCOUNT_JSON', '{}');
    vi.mocked(internalRequest).mockResolvedValue({ status: 'ACTIVE', authVersion: 7 });
    const { service, deliver } = subject(); deliver.mockRejectedValue(new Error('provider unavailable'));
    await expect(service.pushDomainEvent(input)).rejects.toThrow('provider unavailable');
  });
});
