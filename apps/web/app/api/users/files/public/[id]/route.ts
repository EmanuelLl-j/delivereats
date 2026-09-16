import { NextResponse } from 'next/server';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 });
  const upstream = await fetch(`${process.env.USERS_SERVICE_URL ?? 'http://localhost:3001'}/files/public/${id}`, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(5_000) }).catch(() => null);
  const location = upstream?.headers.get('location');
  if (!location || ![301, 302, 303, 307, 308].includes(upstream!.status)) return new NextResponse(null, { status: 404 });
  const response = NextResponse.redirect(location); response.headers.set('Cache-Control', 'no-store'); return response;
}
