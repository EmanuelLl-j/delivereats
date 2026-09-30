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
 * Cada endpoint tiene un shape específico que el frontend espera.
 */
function fallbackResponse(service: string, path: string[]): { status: number; body: unknown } {
  const joined = `/${service}/${path.join('/')}`.toLowerCase();

  // users-service endpoints (shape por si falla)
  if (joined.includes('/users/admin/user-metrics'))
    return { status: 200, body: { active: 0, total: 0, usersByRole: {}, usersByStatus: {} } };

  // orders-service endpoints
  if (joined.includes('/orders/admin/analytics'))
    return { status: 200, body: { hours: [] } };
  if (joined.includes('/orders/admin/system'))
    return { status: 200, body: [] };
  if (joined.includes('/orders/admin/metrics'))
    return { status: 200, body: { merchants: 0, ordersToday: 0, activeOrders: 0, approvedPayments: 0, rejectedPayments: 0, revenue: 0 } };
  if (joined.includes('/orders/admin/unread-count'))
    return { status: 200, body: { count: 0 } };

  // notifications-service endpoints
  if (joined.includes('/notifications/unread-count'))
    return { status: 200, body: { count: 0 } };

  // drivers-service endpoints y resto → array vacío
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

  // Servicio no responde (no desplegado) → fallback
  if (!response) {
    const fallback = fallbackResponse(service, path);
    return NextResponse.json(fallback.body, { status: fallback.status, headers: { 'Cache-Control': 'no-store' } });
  }

  // Servicio responde 502/503 y NO es users-service → fallback
  if ((response.status === 503 || response.status === 502) && service !== 'users') {
    const fallback = fallbackResponse(service, path);
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