import Constants from 'expo-constants';
import { clearSession, getSession, saveSession, type Session } from './session';
export const apiUrl = (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://10.0.2.2/api';
export const socketUrl = (Constants.expoConfig?.extra?.socketUrl as string | undefined) ?? apiUrl.replace(/\/api\/?$/, '');
export function assetUrl(value?: string | null) { return value?.startsWith('/') ? apiUrl.replace(/\/api\/?$/, '') + value : value ?? undefined; }
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message); }
}
async function timedFetch(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  catch { throw new ApiError('Sin conexión con DeliverEats. Revisa tu red e inténtalo nuevamente.', 0, 'OFFLINE'); }
  finally { clearTimeout(timer); }
}
let refreshing: Promise<boolean> | undefined;
async function refreshSession(token: string) {
  const response = await timedFetch(`${apiUrl}/users/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: token }) });
  if (response.ok) { await saveSession(await response.json() as Session); return true; }
  if (response.status === 401) await clearSession();
  return false;
}
export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const session = await getSession();
  const multipart = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const response = await timedFetch(`${apiUrl}${path}`, { ...init, headers: { ...(multipart ? {} : { 'content-type': 'application/json' }), ...(session?.accessToken ? { authorization: `Bearer ${session.accessToken}` } : {}), ...init.headers } });
  if (response.status === 401 && session?.refreshToken && retry) {
    refreshing ??= refreshSession(session.refreshToken).finally(() => { refreshing = undefined; });
    if (await refreshing) return api<T>(path, init, false);
  }
  const body = await response.json().catch(() => ({})) as T & { message?: string; code?: string };
  if (!response.ok) throw new ApiError(body.message ?? 'No se pudo completar la operación', response.status, body.code);
  return body;
}
export async function login(email: string, password: string): Promise<Session> {
  const body = await api<Session>('/users/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, false);
  if (body.user.role !== 'DRIVER') throw new ApiError('Esta cuenta no corresponde a un repartidor', 403);
  await saveSession(body);
  return body;
}
export async function logout() {
  const session = await getSession();
  try { await api('/users/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: session?.refreshToken }) }); }
  finally { await clearSession(); }
}
