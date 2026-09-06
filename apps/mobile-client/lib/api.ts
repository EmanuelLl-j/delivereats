import Constants from 'expo-constants';
import { getSession, saveSession, type Session } from './session';

const apiUrl =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost/api';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const session = await getSession();
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(session?.accessToken ? { authorization: `Bearer ${session.accessToken}` } : {}),
      ...init.headers,
    },
  });
  if (response.status === 401 && session?.refreshToken && retry) {
    const refreshed = await fetch(`${apiUrl}/users/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    if (refreshed.ok) {
      const next = (await refreshed.json()) as Session;
      await saveSession(next);
      return api<T>(path, init, false);
    }
  }
  const body = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok)
    throw new ApiError(body.message ?? 'No se pudo completar la operación', response.status);
  return body;
}

export async function login(email: string, password: string): Promise<Session> {
  const response = await fetch(`${apiUrl}/users/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await response.json()) as Session & { message?: string };
  if (!response.ok) throw new ApiError(body.message ?? 'Credenciales incorrectas', response.status);
  if (body.user.role !== 'CUSTOMER')
    throw new ApiError('Esta cuenta no corresponde a un cliente', 403);
  await saveSession(body);
  return body;
}
