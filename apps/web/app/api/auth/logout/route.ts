import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sameOrigin } from '../../../../lib/server-auth';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ message: 'Origen no autorizado' }, { status: 403 });
  const jar = await cookies();
  const token = jar.get('access_token')?.value;
  if (token) await fetch(`${process.env.USERS_SERVICE_URL ?? 'http://localhost:3001'}/auth/logout`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: jar.get('refresh_token')?.value }), signal: AbortSignal.timeout(5_000) }).catch(() => null);
  const response = NextResponse.json({ success: true });
  response.cookies.delete('access_token');
  response.cookies.set('refresh_token', '', { httpOnly: true, path: '/api/auth', maxAge: 0 });
  response.cookies.delete('user_role');
  return response;
}
