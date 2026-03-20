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
    .from('supplier_links')
    .select('id, name, url')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ links: data });
}

export async function POST(request: Request) {
  const supabase = getSupabaseClient();
  const body = await request.json();
  const { userId, name, url } = body;

  if (!userId || !name || !url) {
    return NextResponse.json(
      { error: 'userId, name, and url are required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('supplier_links')
    .insert({ user_id: userId, name, url })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
