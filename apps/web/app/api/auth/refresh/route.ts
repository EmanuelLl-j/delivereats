import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sameOrigin, sessionResponse, type Session } from '../../../../lib/server-auth';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ message: 'Origen no autorizado' }, { status: 403 });
  const refreshToken = (await cookies()).get('refresh_token')?.value;
  if (!refreshToken) return NextResponse.json({ message: 'Sesión vencida' }, { status: 401 });
  const upstream = await fetch(`${process.env.USERS_SERVICE_URL ?? 'http://localhost:3001'}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken }), cache: 'no-store', signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!upstream) return NextResponse.json({ message: 'Autenticación no disponible' }, { status: 503 });
  const body = await upstream.json();
  if (!upstream.ok || !body.accessToken) return NextResponse.json({ message: 'Sesión vencida' }, { status: 401 });
  return sessionResponse(body as Session);
}
