import { NextResponse } from 'next/server';
import { sameOrigin, sessionResponse, type Session } from '../../../../lib/server-auth';
type Context = { params: Promise<{ path: string[] }> };
async function proxy(request: Request, context: Context) {
  const { path } = await context.params;
  const endpoint = path.join('/');
  const allowed = ['auth/register', 'auth/forgot-password', 'auth/reset-password', 'auth/verify-email', 'legal/documents'];
  if (!allowed.includes(endpoint) || (request.method === 'GET' && endpoint !== 'legal/documents')) return NextResponse.json({ message: 'Ruta no disponible' }, { status: 404 });
  if (request.method !== 'GET' && !sameOrigin(request)) return NextResponse.json({ message: 'Origen no autorizado' }, { status: 403 });
  const body = request.method === 'GET' ? undefined : await request.json().catch(() => null);
  if (endpoint === 'auth/register' && body) body.role = 'MERCHANT';
  const response = await fetch(`${process.env.USERS_SERVICE_URL ?? 'http://localhost:3001'}/${endpoint}`, { method: request.method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (!response) return NextResponse.json({ message: 'Servicio temporalmente no disponible' }, { status: 503 });
  const result = await response.json();
  if (endpoint === 'auth/register' && response.ok && result.accessToken) return sessionResponse(result as Session);
  return NextResponse.json(result, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
}
export const GET = proxy;
export const POST = proxy;
