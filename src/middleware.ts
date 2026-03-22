import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';
import { deviceCookieName, sessionCookieName, authCookieName } from '@/lib/auth/jwt-session';
import { isReservedSlug } from '@/lib/slug';

function getSupabaseForEdge() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(url, key);
}

function getJwtSecretBytes(): Uint8Array | null {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

function isPublicPath(pathname: string): boolean {
  if (pathname === '/' || pathname === '/login' || pathname === '/register') return true;
  if (pathname === '/connect' || pathname === '/onboarding') return true;
  if (pathname.startsWith('/connect/') || pathname.startsWith('/onboarding/')) return true;
  return false;
}

async function verifyTokenPayload(
  token: string,
  secret: Uint8Array
): Promise<{ sub: string; org: string; slug: string; typ: 'device' | 'session' } | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    const sub = typeof payload.sub === 'string' ? payload.sub : null;
    const org = typeof payload.org === 'string' ? payload.org : null;
    const slug = typeof payload.slug === 'string' ? payload.slug : null;
    if (!sub || !org || !slug) return null;
    // Legacy ps_auth tokens had no `typ` — treat as session
    const typRaw = payload.typ;
    const typ: 'device' | 'session' | null =
      typRaw === 'device' ? 'device' : typRaw === 'session' || typRaw === undefined ? 'session' : null;
    if (!typ) return null;
    return { sub, org, slug, typ };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0];
  if (!first || first === 'api' || first.startsWith('_')) {
    return NextResponse.next();
  }

  if (isReservedSlug(first)) {
    return NextResponse.next();
  }

  if (first.includes('.')) {
    return NextResponse.next();
  }

  const slug = first.toLowerCase();
  const supabase = getSupabaseForEdge();
  const { data: org } = await supabase.from('organization').select('id, slug').eq('slug', slug).maybeSingle();

  if (!org?.id) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.searchParams.set('unknown_shop', '1');
    return NextResponse.redirect(url);
  }

  const secret = getJwtSecretBytes();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-organization-id', org.id);
  requestHeaders.set('x-organization-slug', org.slug ?? slug);

  const isSelectUser = segments[1] === 'select-user';
  const isLegacyLogin = segments[1] === 'login';

  const sessionTok =
    request.cookies.get(sessionCookieName(slug))?.value ?? request.cookies.get(authCookieName(slug))?.value;
  const deviceTok = request.cookies.get(deviceCookieName(slug))?.value;

  const sessionPayload = sessionTok && secret ? await verifyTokenPayload(sessionTok, secret) : null;
  const sessionValid =
    sessionPayload &&
    sessionPayload.slug === slug &&
    sessionPayload.org === org.id &&
    sessionPayload.typ === 'session';

  const devicePayload = deviceTok && secret ? await verifyTokenPayload(deviceTok, secret) : null;
  const deviceValid =
    devicePayload &&
    devicePayload.typ === 'device' &&
    devicePayload.slug === slug &&
    devicePayload.org === org.id;

  if (isLegacyLogin) {
    const url = request.nextUrl.clone();
    url.pathname = `/${slug}/select-user`;
    return NextResponse.redirect(url);
  }

  if (isSelectUser) {
    if (deviceValid) {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  if (sessionValid && sessionPayload) {
    requestHeaders.set('x-user-id', sessionPayload.sub);
    requestHeaders.set('x-organization-id', sessionPayload.org);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (deviceValid) {
    const sel = request.nextUrl.clone();
    sel.pathname = `/${slug}/select-user`;
    return NextResponse.redirect(sel);
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
