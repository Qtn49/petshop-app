import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { hashPin, validatePinFormat } from '@/lib/auth/pin';

type Body = { name: string; pin: string; role?: 'admin' | 'staff'; organization_id: string };

/** POST: Create additional user (step 3). Attaches user to the given organization. */
export async function POST(request: Request) {
  try {
    const supabase = getSupabaseClient();
    const body = (await request.json()) as Body;
    const organization_id = body.organization_id;
    if (!organization_id) return NextResponse.json({ error: 'organization_id is required' }, { status: 400 });
    const name = (body.name ?? '').trim();
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
    if (!validatePinFormat(body.pin ?? '')) {
      return NextResponse.json({ error: 'PIN must be 4 to 6 digits' }, { status: 400 });
    }
    const role = body.role === 'admin' ? 'admin' : 'staff';

    const pin_hash = await hashPin(body.pin);

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        organization_id,
        name,
        pin_hash,
        role,
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
