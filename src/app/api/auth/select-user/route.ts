import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { verifyPin, hashPin } from '@/lib/auth/pin';
import {
  isJwtSecretConfigured,
  signSessionToken,
  setSessionCookie,
} from '@/lib/auth/jwt-session';

function isLegacySha256Hash(h: string): boolean {
  return h.length === 64 && /^[a-f0-9]+$/.test(h);
}

async function legacySha256Hash(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** POST — verify user PIN and open working session (8h). */
export async function POST(request: Request) {
  try {
    if (!isJwtSecretConfigured()) {
      return NextResponse.json(
        { error: 'Server configuration error: set JWT_SECRET (min 32 characters) in .env.local' },
        { status: 503 }
      );
    }

    const body = (await request.json()) as { userId?: string; pin?: string; slug?: string };
    const userId = (body.userId ?? '').trim();
    const pin = body.pin ?? '';
    const slug = (body.slug ?? '').trim().toLowerCase();

    if (!userId || !pin || !slug) {
      return NextResponse.json({ error: 'userId, pin, and slug required' }, { status: 400 });
    }
    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN must be exactly 4 digits' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { data: org } = await supabase.from('organization').select('id').eq('slug', slug).maybeSingle();
    if (!org?.id) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, pin_hash, role, organization_id')
      .eq('id', userId)
      .eq('organization_id', org.id)
      .maybeSingle();

    if (error || !user?.pin_hash) {
      return NextResponse.json({ error: 'Invalid user' }, { status: 401 });
    }

    let valid = await verifyPin(pin, user.pin_hash as string);
    if (!valid && isLegacySha256Hash(user.pin_hash as string)) {
      const legacyHash = await legacySha256Hash(pin);
      if (legacyHash === user.pin_hash) {
        valid = true;
        const newHash = await hashPin(pin);
        await supabase.from('users').update({ pin_hash: newHash, updated_at: new Date().toISOString() }).eq('id', userId);
      }
    }
    if (!valid) {
      return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 });
    }

    const organization_id = (user as { organization_id?: string }).organization_id;
    if (!organization_id) {
      return NextResponse.json({ error: 'Invalid user' }, { status: 401 });
    }

    const token = await signSessionToken({
      sub: user.id as string,
      org: organization_id,
      slug,
    });

    const role = (user as { role?: string }).role ?? 'staff';
    const json = NextResponse.json({
      success: true,
      organizationId: organization_id,
      user: {
        id: user.id,
        name: user.name,
        role: role === 'admin' ? 'admin' : 'staff',
      },
    });
    return setSessionCookie(json, slug, token);
  } catch (err) {
    console.error('[POST /api/auth/select-user]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
