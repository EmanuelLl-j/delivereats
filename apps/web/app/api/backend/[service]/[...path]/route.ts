import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const serviceUrls: Record<string, string> = {
  users: process.env.USERS_SERVICE_URL ?? 'http://localhost:3001',
  orders: process.env.ORDERS_SERVICE_URL ?? 'http://localhost:3002',
  drivers: process.env.DRIVERS_SERVICE_URL ?? 'http://localhost:3003',
  notifications: process.env.NOTIFICATIONS_SERVICE_URL ?? 'http://localhost:3004',
};

type Context = { params: Promise<{ service: string; path: string[] }> };

async function proxy(request: Request, context: Context) {
  const { service, path } = await context.params;
  const base = serviceUrls[service];
  if (!base) return NextResponse.json({ message: 'Servicio desconocido' }, { status: 404 });
  const token = (await cookies()).get('access_token')?.value;
  if (!token) return NextResponse.json({ message: 'Sesión no disponible' }, { status: 401 });
  const incoming = new URL(request.url);
  const target = `${base}/${path.join('/')}${incoming.search}`;
  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const response = await fetch(target, {
    method: request.method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': request.headers.get('content-type') ?? 'application/json',
      'x-correlation-id': request.headers.get('x-correlation-id') ?? crypto.randomUUID(),
    },
    body: hasBody ? await request.text() : undefined,
    cache: 'no-store',
  }).catch(() => null);
  if (!response)
    return NextResponse.json({ message: 'El servicio no está disponible' }, { status: 503 });
  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') ?? 'application/json' },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
