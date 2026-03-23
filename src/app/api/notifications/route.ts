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
    .from('notifications')
    .select('id, title, message, type, read')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ notifications: data });
}

export async function POST(request: Request) {
  const supabase = getSupabaseClient();
  const body = await request.json();
  const { userId, title, message, type } = body as {
    userId?: string;
    title?: string;
    message?: string;
    type?: string;
  };

  if (!userId || !title) {
    return NextResponse.json({ error: 'userId and title required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('notifications')
    .insert({ user_id: userId, title, message: message ?? null, type: type ?? 'info' })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
