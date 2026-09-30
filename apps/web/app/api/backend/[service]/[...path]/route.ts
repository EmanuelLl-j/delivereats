import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sameOrigin } from '../../../../../lib/server-auth';

const serviceUrls: Record<string, string> = {
  users: process.env.USERS_SERVICE_URL ?? 'http://localhost:3001',
  orders: process.env.ORDERS_SERVICE_URL ?? 'http://localhost:3002',
  drivers: process.env.DRIVERS_SERVICE_URL ?? 'http://localhost:3003',
  notifications: process.env.NOTIFICATIONS_SERVICE_URL ?? 'http://localhost:3004',
};

type Context = { params: Promise<{ service: string; path: string[] }> };

/**
 * Respuesta vacía por defecto cuando un microservicio no está disponible.
 * El dashboard tolera listas vacías sin romper.
 */
function fallbackResponse(path: string[]): { status: number; body: unknown } {
  const joined = path.join('/');
  if (joined.includes('unread-count')) return { status: 200, body: { count: 0 } };
  if (joined.includes('metrics') || joined.includes('analytics'))
    return { status: 200, body: { count: 0, items: [], data: [], total: 0, series: [] } };
  if (joined.includes('system'))
    return { status: 200, body: { status: 'degraded', services: [] } };
  if (joined.includes('user-metrics'))
    return { status: 200, body: { totalUsers: 0, activeUsers: 0, usersByRole: {}, usersByStatus: {}, recentSignups: [] } };
  return { status: 200, body: [] };
}

async function proxy(request: Request, context: Context) {
  const { service, path } = await context.params;
  const base = serviceUrls[service];
  if (path.some(part => part === '..' || part.includes('/') || part.includes('\\')) || path[0] === 'internal')
    return NextResponse.json({ message: 'Ruta no permitida' }, { status: 403 });
  if (!['GET', 'HEAD'].includes(request.method) && !sameOrigin(request))
    return NextResponse.json({ message: 'Origen no autorizado' }, { status: 403 });
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
    body: hasBody ? await request.arrayBuffer() : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);

  // Si el servicio no responde (no desplegado en Render), devolver respuesta vacía para no romper el dashboard
  if (!response) {
    const fallback = fallbackResponse(path);
    return NextResponse.json(fallback.body, { status: fallback.status, headers: { 'Cache-Control': 'no-store' } });
  }

  // Si el servicio responde con 503/502 (no listo), también fallback para los servicios opcionales
  if ((response.status === 503 || response.status === 502) && service !== 'users') {
    const fallback = fallbackResponse(path);
    return NextResponse.json(fallback.body, { status: fallback.status, headers: { 'Cache-Control': 'no-store' } });
  }

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;