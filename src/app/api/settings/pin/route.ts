import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { hashPin, verifyPin, validatePinFormat } from '@/lib/auth/pin';

export async function POST(request: Request) {
  const body = await request.json();
  const { userId, currentPin, newPin } = body;

  if (!userId || !currentPin || !newPin) {
    return NextResponse.json(
      { error: 'userId, currentPin, and newPin required' },
      { status: 400 }
    );
  }

  if (!validatePinFormat(newPin)) {
    return NextResponse.json({ error: 'New PIN must be 4 to 6 digits' }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('id, pin_hash')
    .eq('id', userId)
    .single();

  if (fetchError || !user?.pin_hash) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const valid = await verifyPin(currentPin, user.pin_hash);
  if (!valid) {
    return NextResponse.json({ error: 'Current PIN is incorrect' }, { status: 401 });
  }

  const newPinHash = await hashPin(newPin);
  const { error: updateError } = await supabase
    .from('users')
    .update({ pin_hash: newPinHash, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
