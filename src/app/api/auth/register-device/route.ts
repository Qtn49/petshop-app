import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { verifyPin, hashPin, validatePinFormat } from '@/lib/auth/pin';
import { isJwtSecretConfigured, signDeviceToken, setDeviceCookie } from '@/lib/auth/jwt-session';

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

/** POST — register device with shop slug + admin PIN (4 digits). */
export async function POST(request: Request) {
  try {
    if (!isJwtSecretConfigured()) {
      return NextResponse.json(
        { error: 'Server configuration error: set JWT_SECRET (min 32 characters) in .env.local' },
        { status: 503 }
      );
    }

    const body = (await request.json()) as { slug?: string; pin?: string };
    const slug = (body.slug ?? '').trim().toLowerCase();
    const pin = body.pin ?? '';

    if (!slug || !pin) {
      return NextResponse.json({ error: 'slug and pin required' }, { status: 400 });
    }
    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN must be exactly 4 digits' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { data: org, error: orgErr } = await supabase
      .from('organization')
      .select('id, slug, company_name')
      .eq('slug', slug)
      .maybeSingle();

    if (orgErr || !org?.id) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    const { data: admins, error: usersErr } = await supabase
      .from('users')
      .select('id, pin_hash, role')
      .eq('organization_id', org.id)
      .eq('role', 'admin');

    if (usersErr || !admins?.length) {
      return NextResponse.json({ error: 'Only admins can register a new device' }, { status: 403 });
    }

    let matchedAdminId: string | null = null;
    for (const row of admins) {
      const uid = (row as { id: string }).id;
      const pinHash = (row as { pin_hash?: string }).pin_hash;
      if (!pinHash) continue;

      let valid = await verifyPin(pin, pinHash);
      if (!valid && isLegacySha256Hash(pinHash)) {
        const legacyHash = await legacySha256Hash(pin);
        if (legacyHash === pinHash) {
          valid = true;
          const newHash = await hashPin(pin);
          await supabase.from('users').update({ pin_hash: newHash, updated_at: new Date().toISOString() }).eq('id', uid);
        }
      }
      if (valid) {
        matchedAdminId = uid;
        break;
      }
    }

    if (!matchedAdminId) {
      return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 });
    }

    const token = await signDeviceToken({
      sub: matchedAdminId,
      org: org.id as string,
      slug,
      role: 'admin',
    });

    const json = NextResponse.json({
      success: true,
      organizationName: (org as { company_name?: string | null }).company_name ?? 'Pet Shop',
    });
    return setDeviceCookie(json, slug, token);
  } catch (err) {
    console.error('[POST /api/auth/register-device]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
