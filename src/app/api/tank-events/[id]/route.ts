import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseClient();
  const body = await request.json();
  const { userId, event_date, deaths, notes } = body;

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  // Verify ownership via tank_id → tanks.user_id
  const { data: existing } = await supabase
    .from('tank_events')
    .select('id, tank_id, tanks!inner(user_id)')
    .eq('id', id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const tank = existing.tanks as unknown as { user_id: string };
  if (tank.user_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if (event_date !== undefined) updates.event_date = event_date;
  if (deaths !== undefined) updates.deaths = deaths;
  if (notes !== undefined) updates.notes = notes || null;

  const { data, error } = await supabase
    .from('tank_events')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  const { data: existing } = await supabase
    .from('tank_events')
    .select('id, tank_id, tanks!inner(user_id)')
    .eq('id', id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const tank = existing.tanks as unknown as { user_id: string };
  if (tank.user_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabase.from('tank_events').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
