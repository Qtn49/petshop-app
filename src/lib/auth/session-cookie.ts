import type { NextResponse } from 'next/server';

export const COOKIE_UID = 'petshop_uid';
export const COOKIE_OID = 'petshop_oid';
export const COOKIE_SLUG = 'petshop_slug';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function cookieOpts() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  };
}

export function appendSessionCookies(
  res: NextResponse,
  opts: { userId: string; organizationId: string; slug: string }
): NextResponse {
  const base = cookieOpts();
  res.cookies.set(COOKIE_UID, opts.userId, base);
  res.cookies.set(COOKIE_OID, opts.organizationId, base);
  res.cookies.set(COOKIE_SLUG, opts.slug, base);
  return res;
}

export function clearSessionCookies(res: NextResponse): NextResponse {
  const base = { path: '/' as const, maxAge: 0 };
  res.cookies.set(COOKIE_UID, '', base);
  res.cookies.set(COOKIE_OID, '', base);
  res.cookies.set(COOKIE_SLUG, '', base);
  return res;
}
