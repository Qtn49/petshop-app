import { SignJWT, jwtVerify } from 'jose';
import type { NextResponse } from 'next/server';

const ALG = 'HS256';

/** Legacy — cleared on full sign-out for migration */
export const AUTH_COOKIE_PREFIX = 'ps_auth_';
export const DEVICE_COOKIE_PREFIX = 'ps_device_';
export const SESSION_COOKIE_PREFIX = 'ps_session_';

export function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters');
  }
  return new TextEncoder().encode(secret);
}

export function isJwtSecretConfigured(): boolean {
  const secret = process.env.JWT_SECRET;
  return Boolean(secret && secret.length >= 32);
}

function cookieSafeSlug(slug: string): string {
  return slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '_');
}

/** @deprecated use sessionCookieName */
export function authCookieName(slug: string): string {
  return `${AUTH_COOKIE_PREFIX}${cookieSafeSlug(slug)}`;
}

export function deviceCookieName(slug: string): string {
  return `${DEVICE_COOKIE_PREFIX}${cookieSafeSlug(slug)}`;
}

export function sessionCookieName(slug: string): string {
  return `${SESSION_COOKIE_PREFIX}${cookieSafeSlug(slug)}`;
}

export type VerifiedJwt =
  | { typ: 'device'; sub: string; org: string; slug: string; role: string }
  | { typ: 'session'; sub: string; org: string; slug: string };

export async function verifyJwtToken(token: string): Promise<VerifiedJwt | null> {
  try {
    const key = getJwtSecretKey();
    const { payload } = await jwtVerify(token, key, { algorithms: [ALG] });
    const sub = typeof payload.sub === 'string' ? payload.sub : null;
    const org = typeof payload.org === 'string' ? payload.org : null;
    const slug = typeof payload.slug === 'string' ? payload.slug : null;
    if (!sub || !org || !slug) return null;
    const typRaw = payload.typ;
    const typ: 'device' | 'session' | null =
      typRaw === 'device' ? 'device' : typRaw === 'session' || typRaw === undefined ? 'session' : null;
    if (!typ) return null;
    if (typ === 'device') {
      const role = typeof payload.role === 'string' ? payload.role : 'admin';
      return { typ: 'device', sub, org, slug, role };
    }
    return { typ: 'session', sub, org, slug };
  } catch {
    return null;
  }
}

const THIRTY_DAYS_SEC = 60 * 60 * 24 * 30;
const EIGHT_HOURS_SEC = 8 * 60 * 60;

export async function signDeviceToken(payload: {
  sub: string;
  org: string;
  slug: string;
  role: 'admin';
}): Promise<string> {
  const key = getJwtSecretKey();
  return new SignJWT({
    org: payload.org,
    slug: payload.slug,
    typ: 'device' as const,
    role: payload.role,
  })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${THIRTY_DAYS_SEC}s`)
    .sign(key);
}

export async function signSessionToken(payload: { sub: string; org: string; slug: string }): Promise<string> {
  const key = getJwtSecretKey();
  return new SignJWT({
    org: payload.org,
    slug: payload.slug,
    typ: 'session' as const,
  })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${EIGHT_HOURS_SEC}s`)
    .sign(key);
}

export function setDeviceCookie(res: NextResponse, slug: string, token: string): NextResponse {
  const name = deviceCookieName(slug);
  res.cookies.set(name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: THIRTY_DAYS_SEC,
  });
  return res;
}

export function setSessionCookie(res: NextResponse, slug: string, token: string): NextResponse {
  const name = sessionCookieName(slug);
  res.cookies.set(name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: EIGHT_HOURS_SEC,
  });
  return res;
}

function clearCookie(res: NextResponse, name: string): void {
  res.cookies.set(name, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}

export function clearDeviceCookie(res: NextResponse, slug: string): NextResponse {
  clearCookie(res, deviceCookieName(slug));
  return res;
}

export function clearSessionCookie(res: NextResponse, slug: string): NextResponse {
  clearCookie(res, sessionCookieName(slug));
  return res;
}

/** Clear device + session + legacy ps_auth for this slug */
export function clearAllAuthCookies(res: NextResponse, slug: string): NextResponse {
  clearCookie(res, deviceCookieName(slug));
  clearCookie(res, sessionCookieName(slug));
  clearCookie(res, authCookieName(slug));
  return res;
}

export function clearSessionOnly(res: NextResponse, slug: string): NextResponse {
  clearSessionCookie(res, slug);
  clearCookie(res, authCookieName(slug));
  return res;
}
