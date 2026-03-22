import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseClient();
  const body = await request.json().catch(() => ({}));
  const { userId, name, description, bulk_update } = body;

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const { data: group } = await supabase
    .from('water_groups')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (!group) {
    return NextResponse.json({ error: 'Water group not found' }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description?.trim() || null;

  if (Object.keys(updates).length > 0) {
    const { error: updateErr } = await supabase
      .from('water_groups')
      .update(updates)
      .eq('id', id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }
  }

  if (bulk_update === true) {
    const { temperature, ph, last_cleaned_at } = body;
    const tankUpdates: Record<string, unknown> = {};
    if (temperature !== undefined) tankUpdates.temperature = temperature;
    if (ph !== undefined) tankUpdates.ph = ph;
    if (last_cleaned_at !== undefined) tankUpdates.last_cleaned_at = last_cleaned_at;

    if (Object.keys(tankUpdates).length > 0) {
      await supabase
        .from('tanks')
        .update(tankUpdates)
        .eq('water_group_id', id);
    }
  }

  const { data: updated } = await supabase
    .from('water_groups')
    .select('*')
    .eq('id', id)
    .single();

  return NextResponse.json(updated ?? group);
}
