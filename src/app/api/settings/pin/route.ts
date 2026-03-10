import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: Request) {
  const body = await request.json();
  const { userId, currentPin, newPin } = body;

  if (!userId || !currentPin || !newPin) {
    return NextResponse.json(
      { error: 'userId, currentPin, and newPin required' },
      { status: 400 }
    );
  }

  if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
    return NextResponse.json({ error: 'New PIN must be 4 digits' }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const currentHash = await hashPin(currentPin);
  const newHash = await hashPin(newPin);

  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('id, pin_hash')
    .eq('id', userId)
    .single();

  if (fetchError || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (user.pin_hash !== currentHash) {
    return NextResponse.json({ error: 'Current PIN is incorrect' }, { status: 401 });
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({ pin_hash: newHash, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
