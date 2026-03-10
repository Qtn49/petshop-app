import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

export async function GET(
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
  const { data: tank } = await supabase
    .from('tanks')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (!tank) {
    return NextResponse.json({ error: 'Tank not found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('tank_events')
    .select('*')
    .eq('tank_id', id)
    .order('event_date', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseClient();
  const body = await request.json();
  const { userId, event_date, deaths, notes } = body;

  if (!userId || !event_date) {
    return NextResponse.json(
      { error: 'userId and event_date required' },
      { status: 400 }
    );
  }

  const { data: tank } = await supabase
    .from('tanks')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (!tank) {
    return NextResponse.json({ error: 'Tank not found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('tank_events')
    .insert({
      tank_id: id,
      event_date,
      deaths: deaths ?? 0,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
