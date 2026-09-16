'use client';

let refreshing: Promise<boolean> | undefined;
export class ApiError extends Error { constructor(message: string, readonly status: number) { super(message); } }
export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  let response = await fetch(url, init);
  if (response.status === 401 && url.startsWith('/api/backend/')) {
    refreshing ??= fetch('/api/auth/refresh', { method: 'POST' }).then(result => result.ok).catch(() => false).finally(() => { refreshing = undefined; });
    if (await refreshing) response = await fetch(url, init);
    else { window.location.assign('/login'); throw new Error('Tu sesión venció. Inicia sesión nuevamente.'); }
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(body && typeof body === 'object' && 'message' in body ? String(body.message) : 'No se pudo completar la operación', response.status);
  return body as T;
}
export const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
export async function uploadFile(file: File, purpose: string) {
  const form = new FormData(); form.set('file', file);
  return apiRequest<{ id: string; url?: string }>('/api/backend/users/files?purpose=' + encodeURIComponent(purpose), { method: 'POST', body: form });
}
