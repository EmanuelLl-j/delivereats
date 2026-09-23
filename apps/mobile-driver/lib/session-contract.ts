export type Session = { accessToken: string; refreshToken: string; user: { id: string; role: string; firstName: string; lastName?: string; emailVerifiedAt?: string | null } };

export function isSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Session>;
  return typeof candidate.accessToken === 'string' && typeof candidate.refreshToken === 'string' && !!candidate.user && typeof candidate.user.id === 'string' && candidate.user.role === 'DRIVER' && typeof candidate.user.firstName === 'string';
}

export function parseSession(value: string | null): Session | null {
  if (!value) return null;
  try { const parsed: unknown = JSON.parse(value); return isSession(parsed) ? parsed : null; } catch { return null; }
}

export async function resolveStartupRoute(read: () => Promise<Session | null>): Promise<'/(tabs)/home' | '/login'> {
  try { return (await read()) ? '/(tabs)/home' : '/login'; } catch { return '/login'; }
}
