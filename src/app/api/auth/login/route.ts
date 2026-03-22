import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { verifyPin, hashPin, validatePinFormat } from '@/lib/auth/pin';
import { clearSessionCookies } from '@/lib/auth/session-cookie';
import { signSessionToken, setSessionCookie, isJwtSecretConfigured } from '@/lib/auth/jwt-session';

type Body = { userId?: string; slug?: string; pin: string; userName?: string };

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

async function verifyUserPin(
  supabase: ReturnType<typeof getSupabaseClient>,
  userId: string,
  pin: string
): Promise<{ id: string; name: string | null; email: string | null; role: string; organization_id: string } | null> {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, name, email, pin_hash, role, organization_id')
    .eq('id', userId)
    .single();

  if (error || !user?.pin_hash) return null;

  let valid = await verifyPin(pin, user.pin_hash as string);
  if (!valid && isLegacySha256Hash(user.pin_hash as string)) {
    const legacyHash = await legacySha256Hash(pin);
    if (legacyHash === user.pin_hash) {
      valid = true;
      const newHash = await hashPin(pin);
      await supabase.from('users').update({ pin_hash: newHash, updated_at: new Date().toISOString() }).eq('id', userId);
    }
  }
  if (!valid) return null;

  const role = (user as { role?: string }).role ?? 'staff';
  const organization_id = (user as { organization_id?: string }).organization_id;
  if (!organization_id) return null;

  return {
    id: user.id as string,
    name: (user as { name?: string | null }).name ?? null,
    email: (user as { email?: string | null }).email ?? null,
    role,
    organization_id,
  };
}

/** POST: Verify PIN with shop slug + PIN, or legacy userId + PIN. Sets httpOnly session cookies for middleware. */
export async function POST(request: Request) {
  try {
    if (!isJwtSecretConfigured()) {
      console.error('[POST /api/auth/login] JWT_SECRET is missing or shorter than 32 characters');
      return NextResponse.json(
        { error: 'Server configuration error: set JWT_SECRET (min 32 characters) in .env.local' },
        { status: 503 }
      );
    }

    const body = (await request.json()) as Body;
    const { pin } = body;
    if (!pin) {
      return NextResponse.json({ error: 'pin required' }, { status: 400 });
    }
    if (!validatePinFormat(pin)) {
      return NextResponse.json({ error: 'PIN must be 4 to 6 digits' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    let resolved: {
      id: string;
      name: string | null;
      email: string | null;
      role: string;
      organization_id: string;
    } | null = null;

    if (body.slug) {
      const slug = (body.slug as string).trim().toLowerCase();
      const { data: org } = await supabase.from('organization').select('id, slug').eq('slug', slug).maybeSingle();
      if (!org?.id) {
        return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
      }

      const userIdRaw = (body.userId ?? '').trim();
      const userNameRaw = (body.userName ?? '').trim();

      if (userIdRaw) {
        const { data: member } = await supabase
          .from('users')
          .select('id')
          .eq('id', userIdRaw)
          .eq('organization_id', org.id)
          .maybeSingle();
        if (!member?.id) {
          return NextResponse.json({ error: 'User not found for this shop' }, { status: 401 });
        }
        resolved = await verifyUserPin(supabase, userIdRaw, pin);
        if (!resolved) {
          return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
        }
      } else if (userNameRaw) {
        const { data: users } = await supabase
          .from('users')
          .select('id, name')
          .eq('organization_id', org.id);
        const lower = userNameRaw.toLowerCase();
        const candidates = (users ?? []).filter(
          (u) => ((u as { name?: string | null }).name ?? '').trim().toLowerCase() === lower
        );
        if (candidates.length === 0) {
          return NextResponse.json({ error: 'Name not found for this shop' }, { status: 401 });
        }
        for (const u of candidates) {
          const uid = (u as { id: string }).id;
          const ok = await verifyUserPin(supabase, uid, pin);
          if (ok) {
            resolved = ok;
            break;
          }
        }
        if (!resolved) {
          return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
        }
      } else {
        return NextResponse.json({ error: 'Select a team member' }, { status: 400 });
      }
    } else if (body.userId) {
      resolved = await verifyUserPin(supabase, body.userId, pin);
      if (!resolved) {
        return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
      }
    } else {
      return NextResponse.json({ error: 'slug or userId required' }, { status: 400 });
    }

    const { data: orgRow } = await supabase
      .from('organization')
      .select('slug')
      .eq('id', resolved.organization_id)
      .maybeSingle();
    const slug = (orgRow as { slug?: string | null } | null)?.slug;
    if (!slug) {
      return NextResponse.json({ error: 'Organization has no URL slug' }, { status: 500 });
    }

    const json = NextResponse.json({
      slug,
      user: {
        id: resolved.id,
        name: resolved.name,
        email: resolved.email,
        role: resolved.role,
        organization_id: resolved.organization_id,
      },
      organization_id: resolved.organization_id,
      login_timestamp: new Date().toISOString(),
    });
    clearSessionCookies(json);
    const token = await signSessionToken({ sub: resolved.id, org: resolved.organization_id, slug });
    return setSessionCookie(json, slug, token);
  } catch (err) {
    console.error('[POST /api/auth/login]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
