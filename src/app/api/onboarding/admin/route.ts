import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { hashPin, validatePinFormat } from '@/lib/auth/pin';

type Body = { name: string; pin: string };

/** POST: Create first admin user (step 2). Requires organization to exist and no users yet. */
export async function POST(request: Request) {
  try {
    const supabase = getSupabaseClient();
    const { data: org } = await supabase.from('organization').select('id').limit(1).maybeSingle();
    if (!org?.id) {
      return NextResponse.json({ error: 'Complete company setup first' }, { status: 400 });
    }

    const { data: existingUser } = await supabase.from('users').select('id').limit(1).maybeSingle();
    if (existingUser?.id) {
      return NextResponse.json({ error: 'Admin already created' }, { status: 400 });
    }

    const body = (await request.json()) as Body;
    const name = (body.name ?? '').trim();
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
    if (!validatePinFormat(body.pin ?? '')) {
      return NextResponse.json({ error: 'PIN must be 4 to 6 digits' }, { status: 400 });
    }

    const pin_hash = await hashPin(body.pin);

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        organization_id: org.id,
        name,
        pin_hash,
        role: 'admin',
        updated_at: new Date().toISOString(),
      })
      .select('id, name, role')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ user: { id: user.id, name: user.name, role: user.role } });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
