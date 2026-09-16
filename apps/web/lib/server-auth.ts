import { NextResponse } from 'next/server';
export type Session = { accessToken: string; refreshToken: string; user: { id: string; role: string } };
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return origin === new URL(request.url).origin || (Boolean(process.env.WEB_URL) && origin === process.env.WEB_URL);
}
export function sessionResponse(session: Session) {
  const response = NextResponse.json({ role: session.user.role, user: session.user });
  const secure = process.env.COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production';
  response.cookies.set('access_token', session.accessToken, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 15 * 60 });
  response.cookies.set('refresh_token', session.refreshToken, { httpOnly: true, secure, sameSite: 'strict', path: '/api/auth', maxAge: 7 * 24 * 60 * 60 });
  response.cookies.set('user_role', session.user.role, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60 });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
