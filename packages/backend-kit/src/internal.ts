import { HttpException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { JwtPayload } from '@delivereats/shared-types';

export async function assertCurrentIdentity(user: JwtPayload) {
  if (!user.sub || !user.exp || user.exp * 1000 <= Date.now()) throw new UnauthorizedException('Sesión vencida');
  const state = await internalRequest<{ status: string; role: string; authVersion: number }>('users', `/internal/users/${encodeURIComponent(user.sub)}/auth-state`);
  if (state.status !== 'ACTIVE' || state.role !== user.role || state.authVersion !== (user.authVersion ?? 0)) throw new UnauthorizedException('Sesión revocada');
  return user;
}

export function authorizeInternal(secret?: string): void {
  const expected = process.env.INTERNAL_SERVICE_SECRET;
  if (!secret || !expected || Buffer.byteLength(secret) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(secret), Buffer.from(expected))) {
    throw new UnauthorizedException('Credencial interna inválida');
  }
}

const defaults = { users: 3001, orders: 3002, drivers: 3003, notifications: 3004 };
export async function internalRequest<T>(
  service: keyof typeof defaults,
  path: string,
  body?: object,
  method = body ? 'POST' : 'GET',
): Promise<T> {
  const base = process.env[`${service.toUpperCase()}_SERVICE_URL`] ?? `http://127.0.0.1:${defaults[service]}`;
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-internal-service-secret': process.env.INTERNAL_SERVICE_SECRET ?? '' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);
  if (!response) throw new ServiceUnavailableException('Un servicio necesario no está disponible');
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'message' in data ? String(data.message) : 'Operación no autorizada';
    throw new HttpException(message, response.status);
  }
  return data as T;
}

export async function requireLegal(userId: string, types: string[]) {
  return internalRequest<{ accepted: true; documentIds: string[] }>('users', '/internal/users/legal-check', { userId, types });
}

export async function requireOwnedFile(userId: string, fileId: string, purposes: string[]) {
  return internalRequest<{ id: string; objectKey: string; mimeType: string }>('users', '/internal/users/file-check', { userId, fileId, purposes });
}
