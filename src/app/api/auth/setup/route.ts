import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

// One-time setup: Create first user with PIN 1234
// In production, remove this or protect it
export async function POST(request: Request) {
  try {
    const supabase = getSupabaseClient();
    const { pin } = await request.json();
    if (!pin || pin.length !== 4) {
      return NextResponse.json({ error: 'PIN must be 4 digits' }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const pinHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    const { data: user, error } = await supabase
      .from('users')
      .insert({ pin_hash: pinHash, name: 'Admin' })
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, userId: user.id });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
