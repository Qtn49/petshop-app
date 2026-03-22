import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_REGEX.test(s);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseClient();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const query = supabase
    .from('tanks')
    .select('*')
    .eq('user_id', userId);

  if (isUuid(id)) {
    query.eq('id', id);
  } else {
    query.eq('slug', id);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    return NextResponse.json({ error: 'Tank not found' }, { status: 404 });
  }

  return NextResponse.json({ tank: data });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseClient();
  const body = await request.json().catch(() => ({}));
  const userId = body.userId;

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const query = supabase
    .from('tanks')
    .select('id')
    .eq('user_id', userId);

  if (isUuid(id)) {
    query.eq('id', id);
  } else {
    query.eq('slug', id);
  }

  const { data: tank } = await query.single();

  if (!tank) {
    return NextResponse.json({ error: 'Tank not found' }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (body.temperature !== undefined) updates.temperature = body.temperature;
  if (body.ph !== undefined) updates.ph = body.ph;
  if (body.last_cleaned_at !== undefined) updates.last_cleaned_at = body.last_cleaned_at;
  if (body.water_group_id !== undefined) updates.water_group_id = body.water_group_id;
  if (body.name !== undefined) updates.name = body.name;
  if (body.fish_species !== undefined) updates.fish_species = body.fish_species;
  if (body.fish_count !== undefined) updates.fish_count = body.fish_count;
  if (body.notes !== undefined) updates.notes = body.notes;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('tanks')
    .update(updates)
    .eq('id', tank.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tank: data });
}
