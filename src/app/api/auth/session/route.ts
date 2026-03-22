import { NextResponse } from 'next/server';
import { clearSessionCookies } from '@/lib/auth/session-cookie';
import { clearAllAuthCookies, clearSessionOnly, isJwtSecretConfigured } from '@/lib/auth/jwt-session';

type DeleteBody = { slug?: string; sessionOnly?: boolean };

/**
 * DELETE /api/auth/session — clear auth cookies.
 * Body: { slug: string, sessionOnly?: boolean }
 * - sessionOnly true: clear ps_session_[slug] only (switch user)
 * - default: clear ps_device_ + ps_session_ + legacy ps_auth_
 */
export async function DELETE(request: Request) {
  try {
    let slug = '';
    let sessionOnly = false;
    try {
      const b = (await request.json()) as DeleteBody;
      slug = typeof b.slug === 'string' ? b.slug.trim().toLowerCase() : '';
      sessionOnly = b.sessionOnly === true;
    } catch {
      const { searchParams } = new URL(request.url);
      slug = (searchParams.get('slug') ?? '').trim().toLowerCase();
    }
    if (!slug) {
      return NextResponse.json({ error: 'slug required' }, { status: 400 });
    }

    const res = NextResponse.json({ success: true });
    if (sessionOnly) {
      return clearSessionOnly(res, slug);
    }
    clearSessionCookies(res);
    return clearAllAuthCookies(res, slug);
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/** POST removed — use POST /api/auth/select-user instead */
export async function POST() {
  if (!isJwtSecretConfigured()) {
    return NextResponse.json({ error: 'Use POST /api/auth/select-user' }, { status: 410 });
  }
  return NextResponse.json({ error: 'Use POST /api/auth/select-user' }, { status: 410 });
}
