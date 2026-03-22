import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

export async function GET(request: Request) {
  const supabase = getSupabaseClient();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('water_groups')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const supabase = getSupabaseClient();
  const body = await request.json().catch(() => ({}));
  const { userId, name, description } = body;

  if (!userId || !name?.trim()) {
    return NextResponse.json(
      { error: 'userId and name required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('water_groups')
    .insert({
      user_id: userId,
      name: name.trim(),
      description: description?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
