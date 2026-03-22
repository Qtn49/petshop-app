import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(s: string): boolean {
  return UUID_REGEX.test(s);
}

async function resolveTankId(
  supabase: ReturnType<typeof getSupabaseClient>,
  idOrSlug: string,
  userId: string
): Promise<string | null> {
  const query = supabase
    .from('tanks')
    .select('id')
    .eq('user_id', userId);
  if (isUuid(idOrSlug)) {
    query.eq('id', idOrSlug);
  } else {
    query.eq('slug', idOrSlug);
  }
  const { data } = await query.single();
  return data?.id ?? null;
}

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
  const tankId = await resolveTankId(supabase, id, userId);

  if (!tankId) {
    return NextResponse.json({ error: 'Tank not found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('tank_events')
    .select('*')
    .eq('tank_id', tankId)
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

  const tankId = await resolveTankId(supabase, id, userId);

  if (!tankId) {
    return NextResponse.json({ error: 'Tank not found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('tank_events')
    .insert({
      tank_id: tankId,
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
