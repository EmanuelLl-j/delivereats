import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';

vi.mock('bcrypt', () => ({
  hash: vi.fn(async (value: string) => `hashed:${value}`),
  compare: vi.fn(async (value: string, hashed: string) => hashed === `hashed:${value}`),
}));

const demoUser = {
  id: '11111111-1111-4111-8111-111111111111',
  firstName: 'Ana',
  lastName: 'Quispe',
  email: 'cliente@delivereats.local',
  phone: null,
  passwordHash: 'hashed:Demo12345!',
  role: 'CUSTOMER',
  status: 'ACTIVE',
  avatarUrl: null,
  failedAttempts: 0,
  lockedUntil: null,
  lastLoginAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('AuthService', () => {
  let prisma: Record<string, unknown>;
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: vi.fn(async () => null),
        findUnique: vi.fn(async () => demoUser),
        create: vi.fn(async () => demoUser),
        update: vi.fn(async () => demoUser),
      },
      refreshSession: { create: vi.fn(async () => ({})) },
    };
    const jwt = {
      signAsync: vi.fn(async (_payload: unknown, options: { expiresIn: string }) =>
        options.expiresIn === '7d' ? 'refresh-token' : 'access-token',
      ),
    };
    const events = { publish: vi.fn(async () => true) };
    service = new AuthService(prisma as never, jwt as never, events as never);
  });

  it('registers a customer and creates access plus hashed refresh session', async () => {
    const result = await service.register(
      {
        firstName: 'Ana',
        lastName: 'Quispe',
        email: 'cliente@delivereats.local',
        password: 'Demo12345!',
      },
      { correlationId: 'test' },
    );
    expect(result.user.role).toBe('CUSTOMER');
    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(
      (prisma.refreshSession as { create: ReturnType<typeof vi.fn> }).create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tokenHash: 'hashed:refresh-token' }),
      }),
    );
  });

  it('logs in with a valid bcrypt password and clears failed attempts', async () => {
    const result = await service.login(
      { email: 'cliente@delivereats.local', password: 'Demo12345!' },
      { ip: '127.0.0.1' },
    );
    expect(result.user.email).toBe('cliente@delivereats.local');
    expect((prisma.user as { update: ReturnType<typeof vi.fn> }).update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ failedAttempts: 0, lockedUntil: null }),
      }),
    );
  });
});
