import { NextRequest, NextResponse } from 'next/server';
import { updateSession } from './lib/auth';
import { PUBLIC_PATHS, PROTECTED_PATHS } from './lib/config';

/**
 * Next.js 16 proxy (formerly middleware).
 * File must be named proxy.ts and export `proxy`.
 * Refreshes the Supabase session cookie on every request and enforces
 * authentication on protected routes.
 */
export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const { response, user } = await updateSession(req);

  // Allow public and API paths through unconditionally.
  if (PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/api/')) {
    return response;
  }

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));

  if (isProtected && !user) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
