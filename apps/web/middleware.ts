import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const role = request.cookies.get('user_role')?.value;
  const path = request.nextUrl.pathname;
  if (!role) return NextResponse.redirect(new URL('/login', request.url));
  if (path.startsWith('/admin') && role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/comercio', request.url));
  }
  if (path.startsWith('/comercio') && role !== 'MERCHANT') {
    return NextResponse.redirect(new URL('/admin', request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*', '/comercio/:path*'] };
