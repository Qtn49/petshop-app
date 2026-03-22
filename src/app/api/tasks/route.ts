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
    .from('tasks')
    .select('id, title, completed, due_date, created_at')
    .eq('user_id', userId)
    .is('due_date', null)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tasks: data });
}

export async function POST(request: Request) {
  const supabase = getSupabaseClient();
  const body = await request.json();
  const { userId, title, priority } = body;

  if (!userId || !title) {
    return NextResponse.json(
      { error: 'userId and title are required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: userId,
      title,
      due_date: null,
      priority: priority || 'medium',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
