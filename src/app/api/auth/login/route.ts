import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseClient();
    const { pinHash } = await request.json();
    if (!pinHash) {
      return NextResponse.json({ error: 'Missing PIN hash' }, { status: 400 });
    }

    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('pin_hash', pinHash)
      .limit(1);

    if (error || !users?.length) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
    }

    const user = users[0];
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
