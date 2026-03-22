import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { slugFromName } from '@/lib/slug';

export async function GET(request: Request) {
  const supabase = getSupabaseClient();
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');

  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('animals')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ animals: data });
}

export async function POST(request: Request) {
  const supabase = getSupabaseClient();
  const body = await request.json();
  const {
    organizationId, name, species, breed,
    age_months,
    sex, price, status,
    hand_raised, microchipped, vaccinated,
    notes, photos,
  } = body;

  if (!organizationId || !name) {
    return NextResponse.json({ error: 'organizationId and name are required' }, { status: 400 });
  }

  // Generate unique slug
  const baseSlug = slugFromName(name);
  let slug = baseSlug || 'animal';
  let attempt = 1;
  while (true) {
    const { data: existing } = await supabase
      .from('animals')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('slug', slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${baseSlug || 'animal'}-${(attempt++).toString(36)}`;
  }

  const { data, error } = await supabase
    .from('animals')
    .insert({
      organization_id: organizationId,
      slug,
      name,
      species: species || 'other',
      breed: breed || null,
      age_months: age_months ?? null,
      sex: sex || 'unknown',
      price: price != null && price !== '' ? parseFloat(price) : null,
      status: status || 'available',
      hand_raised: species === 'bird' ? (hand_raised ?? false) : null,
      microchipped: microchipped ?? false,
      vaccinated: vaccinated ?? false,
      notes: notes || null,
      photos: photos || [],
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
