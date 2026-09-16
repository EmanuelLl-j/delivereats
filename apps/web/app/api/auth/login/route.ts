import { NextResponse } from 'next/server';
import { sameOrigin, sessionResponse } from '../../../../lib/server-auth';

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: { id: string; role: 'MERCHANT' | 'ADMIN' | 'CUSTOMER' | 'DRIVER' };
};

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ message: 'Origen no autorizado' }, { status: 403 });
  const payload: unknown = await request.json();
  const upstream = await fetch(
    `${process.env.USERS_SERVICE_URL ?? 'http://localhost:3001'}/auth/login`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-correlation-id': crypto.randomUUID() },
      body: JSON.stringify(payload),
      cache: 'no-store',
    },
  ).catch(() => null);

  if (!upstream) {
    return NextResponse.json(
      { message: 'El servicio de usuarios todavía no está disponible' },
      { status: 503 },
    );
  }

  const body = (await upstream.json()) as LoginResponse | { message?: string };
  if (!upstream.ok || !('accessToken' in body)) {
    return NextResponse.json(body, { status: upstream.status });
  }

  if (body.user.role !== 'MERCHANT' && body.user.role !== 'ADMIN') {
    return NextResponse.json(
      { message: 'Esta cuenta debe ingresar desde la aplicación móvil' },
      { status: 403 },
    );
  }

  return sessionResponse(body);
}
