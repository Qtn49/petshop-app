import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { hashPin, validatePinFormat } from '@/lib/auth/pin';
import { appendSessionCookies } from '@/lib/auth/session-cookie';
import { isReservedSlug, slugFromCompanyName } from '@/lib/slug';

type Body = { company_name: string; pin: string; confirm_pin: string; admin_name?: string };

/** POST: Create organization (with slug) + first admin user; sets session cookies. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const company_name = (body.company_name ?? '').trim();
    const adminName = (body.admin_name ?? 'Admin').trim() || 'Admin';
    if (!company_name) {
      return NextResponse.json({ error: 'company_name is required' }, { status: 400 });
    }
    if (body.pin !== body.confirm_pin) {
      return NextResponse.json({ error: 'PINs do not match' }, { status: 400 });
    }
    if (!validatePinFormat(body.pin ?? '')) {
      return NextResponse.json({ error: 'PIN must be 4 to 6 digits' }, { status: 400 });
    }

    let baseSlug = slugFromCompanyName(company_name);
    if (!baseSlug) {
      baseSlug = 'pet-shop';
    }
    if (isReservedSlug(baseSlug)) {
      baseSlug = `${baseSlug}-shop`;
    }

    const supabase = getSupabaseClient();
    let slug = baseSlug;
    for (let i = 0; i < 20; i++) {
      const trySlug = i === 0 ? slug : `${baseSlug}-${i}`;
      const { data: clash } = await supabase.from('organization').select('id').eq('slug', trySlug).maybeSingle();
      if (!clash?.id) {
        slug = trySlug;
        break;
      }
      if (i === 19) {
        return NextResponse.json({ error: 'Could not allocate a unique shop URL' }, { status: 409 });
      }
    }

    const pin_hash = await hashPin(body.pin);
    const now = new Date().toISOString();

    const { data: org, error: orgErr } = await supabase
      .from('organization')
      .insert({
        company_name,
        slug,
        currency: 'AUD',
        updated_at: now,
      })
      .select('id, slug, company_name')
      .single();

    if (orgErr || !org?.id) {
      return NextResponse.json({ error: orgErr?.message ?? 'Failed to create organization' }, { status: 500 });
    }

    const { data: user, error: userErr } = await supabase
      .from('users')
      .insert({
        organization_id: org.id,
        name: adminName,
        pin_hash,
        role: 'admin',
        updated_at: now,
      })
      .select('id, name, role, organization_id')
      .single();

    if (userErr || !user?.id) {
      await supabase.from('organization').delete().eq('id', org.id);
      return NextResponse.json({ error: userErr?.message ?? 'Failed to create user' }, { status: 500 });
    }

    const json = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: null as string | null,
        role: 'admin',
        organization_id: org.id,
      },
      organization_id: org.id,
      slug: org.slug,
      login_timestamp: now,
    });
    return appendSessionCookies(json, {
      userId: user.id as string,
      organizationId: org.id,
      slug: org.slug as string,
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
