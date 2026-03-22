import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseClient } from '@/lib/supabase-server';
import { verifyJwtToken, sessionCookieName, authCookieName } from '@/lib/auth/jwt-session';

/** GET /api/auth/me?slug= — current user from session JWT (ps_session_ or legacy ps_auth_). */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = (searchParams.get('slug') ?? '').trim().toLowerCase();
    if (!slug) {
      return NextResponse.json({ user: null }, { status: 400 });
    }

    const store = cookies();
    const sessionTok =
      store.get(sessionCookieName(slug))?.value ?? store.get(authCookieName(slug))?.value;
    if (!sessionTok) {
      return NextResponse.json({ user: null });
    }

    const payload = await verifyJwtToken(sessionTok);
    if (!payload || payload.slug !== slug || payload.typ !== 'session') {
      return NextResponse.json({ user: null });
    }

    const supabase = getSupabaseClient();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role, organization_id')
      .eq('id', payload.sub)
      .eq('organization_id', payload.org)
      .maybeSingle();

    if (error || !user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: (user as { role?: string }).role ?? 'staff',
        organization_id: (user as { organization_id: string }).organization_id,
      },
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}
