import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AuthService } from './auth.service';

vi.mock('bcrypt', () => ({ hash: vi.fn(async (value: string) => `hashed:${value}`), compare: vi.fn(async (value: string, hashed: string) => hashed === `hashed:${value}`) }));
const password = 'Aa1!' + randomBytes(16).toString('hex');
const fixture = { id: randomUUID(), firstName: 'Prueba', lastName: 'Efímera', email: `${randomUUID()}@example.test`, phone: null, passwordHash: `hashed:${password}`, role: 'CUSTOMER', status: 'ACTIVE', avatarUrl: null, failedAttempts: 0, lockedUntil: null, lastLoginAt: null, emailVerifiedAt: null, authVersion: 0, createdAt: new Date(), updatedAt: new Date() };

describe('AuthService security', () => {
  let service: AuthService;
  const user = { findFirst: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn() };
  const refreshSession = { create: vi.fn(), updateMany: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    user.findFirst.mockResolvedValue(null);
    for (const fn of [user.findUnique, user.findUniqueOrThrow, user.create, user.update]) fn.mockResolvedValue(fixture);
    refreshSession.create.mockResolvedValue({});
    const tx = { emailVerification: { create: vi.fn(), updateMany: vi.fn() } };
    const prisma = { user, refreshSession, $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)) };
    const jwt = { signAsync: vi.fn(async (_payload: unknown, options: { expiresIn: string }) => options.expiresIn === '7d' ? 'refresh-token' : 'access-token') };
    service = new AuthService(prisma as never, jwt as never, { publish: vi.fn(), enqueue: vi.fn() } as never);
  });
  it('creates a customer session without hardcoded credentials', async () => {
    const result = await service.register({ firstName: fixture.firstName, lastName: fixture.lastName, email: fixture.email, password }, {});
    expect(result.user.role).toBe('CUSTOMER');
    expect(result.accessToken).toBe('access-token');
    expect(refreshSession.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tokenHash: 'hashed:' + createHash('sha256').update('refresh-token').digest('hex') }) }));
  });
  it('logs in and clears failed attempts', async () => {
    const result = await service.login({ email: fixture.email, password }, {});
    expect(result.user.email).toBe(fixture.email);
    expect(user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ failedAttempts: 0, lockedUntil: null }) }));
  });
  it('rejects suspended accounts before issuing tokens', async () => {
    user.findUnique.mockResolvedValue({ ...fixture, status: 'SUSPENDED' });
    await expect(service.login({ email: fixture.email, password }, {})).rejects.toThrow('Correo o contraseña incorrectos');
    expect(refreshSession.create).not.toHaveBeenCalled();
  });
  it('increments wrong-password attempts atomically', async () => {
    user.update.mockResolvedValue({ ...fixture, failedAttempts: 5 });
    await expect(service.login({ email: fixture.email, password: 'incorrect' }, {})).rejects.toThrow();
    expect(user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { failedAttempts: { increment: 1 } } }));
    expect(user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { lockedUntil: expect.any(Date) } }));
  });
  it('rejects passwords that would be truncated by bcrypt UTF-8 limits', async () => {
    await expect(service.register({ firstName: 'Nombre', lastName: 'Apellido', email: fixture.email, password: '😀'.repeat(30) }, {})).rejects.toThrow('72 bytes');
    expect(user.create).not.toHaveBeenCalled();
  });
});
