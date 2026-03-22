import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { isReservedSlug, slugFromCompanyName } from '@/lib/slug';

type Body = {
  company_name: string;
  address?: string;
  email?: string;
  phone?: string;
  currency?: string;
};

/** POST: Create organization (step 1). Only allowed when no organization exists. */
export async function POST(request: Request) {
  try {
    const supabase = getSupabaseClient();
    const { data: existing } = await supabase.from('organization').select('id').limit(1).maybeSingle();
    if (existing?.id) {
      return NextResponse.json({ error: 'Organization already configured' }, { status: 400 });
    }

    const body = (await request.json()) as Body;
    const company_name = (body.company_name ?? '').trim();
    if (!company_name) {
      return NextResponse.json({ error: 'company_name is required' }, { status: 400 });
    }

    let baseSlug = slugFromCompanyName(company_name);
    if (!baseSlug) baseSlug = 'pet-shop';
    if (isReservedSlug(baseSlug)) baseSlug = `${baseSlug}-shop`;
    let slug = baseSlug;
    for (let i = 0; i < 20; i++) {
      const trySlug = i === 0 ? slug : `${baseSlug}-${i}`;
      const { data: clash } = await supabase.from('organization').select('id').eq('slug', trySlug).maybeSingle();
      if (!clash?.id) {
        slug = trySlug;
        break;
      }
    }

    const { data, error } = await supabase
      .from('organization')
      .insert({
        company_name,
        slug,
        address: (body.address ?? '').trim() || null,
        email: (body.email ?? '').trim() || null,
        phone: (body.phone ?? '').trim() || null,
        currency: (body.currency ?? 'AUD').trim() || 'AUD',
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: data.id, slug });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
