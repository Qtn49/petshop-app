import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { verifyPin, hashPin, validatePinFormat } from '@/lib/auth/pin';

type Body = { userId: string; pin: string };

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

/** POST: Verify PIN for the given user and return user + role. Session is stored client-side. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const { userId, pin } = body;
    if (!userId || !pin) {
      return NextResponse.json({ error: 'userId and pin required' }, { status: 400 });
    }
    if (!validatePinFormat(pin)) {
      return NextResponse.json({ error: 'PIN must be 4 to 6 digits' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, pin_hash, role, organization_id')
      .eq('id', userId)
      .single();

    if (error || !user?.pin_hash) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
    }

    let valid = await verifyPin(pin, user.pin_hash);
    if (!valid && isLegacySha256Hash(user.pin_hash)) {
      const legacyHash = await legacySha256Hash(pin);
      if (legacyHash === user.pin_hash) {
        valid = true;
        const newHash = await hashPin(pin);
        await supabase.from('users').update({ pin_hash: newHash, updated_at: new Date().toISOString() }).eq('id', userId);
      }
    }
    if (!valid) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
    }

    const role = (user as { role?: string }).role ?? 'staff';
    const organization_id = (user as { organization_id?: string }).organization_id;
    if (!organization_id) {
      return NextResponse.json({ error: 'User has no organization' }, { status: 401 });
    }
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role,
        organization_id,
      },
      organization_id,
      login_timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
