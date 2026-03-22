import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { slugFromName } from '@/lib/slug';

export async function GET(request: Request) {
  const supabase = getSupabaseClient();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('tanks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tanks: data });
}

export async function POST(request: Request) {
  const supabase = getSupabaseClient();
  const body = await request.json();
  const { userId, name, fish_species, fish_count, notes } = body;

  if (!userId || !name) {
    return NextResponse.json(
      { error: 'userId and name are required' },
      { status: 400 }
    );
  }

  const baseSlug = slugFromName(name);
  let slug = baseSlug;
  let attempt = 1;
  while (true) {
    const { data: existing } = await supabase
      .from('tanks')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${(attempt++).toString(36)}`;
  }

  const { data, error } = await supabase
    .from('tanks')
    .insert({
      user_id: userId,
      name,
      slug,
      fish_species: fish_species || null,
      fish_count: fish_count ?? 0,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
