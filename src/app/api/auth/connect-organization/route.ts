import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { verifyPin, validatePinFormat } from '@/lib/auth/pin';

type Body = { organizationIdentifier: string; userName: string; pin: string };

/**
 * Connect to an existing organization: find org by name, find user in org, verify PIN.
 * Returns user + org for session. Does not create or delete any DB records.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const { organizationIdentifier, userName, pin } = body;
    const orgId = (organizationIdentifier ?? '').trim();
    const name = (userName ?? '').trim();
    if (!orgId || !name) {
      return NextResponse.json({ error: 'Organization and user name are required' }, { status: 400 });
    }
    if (!validatePinFormat(pin)) {
      return NextResponse.json({ error: 'PIN must be 4 to 6 digits' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    const { data: orgList } = await supabase
      .from('organization')
      .select('id')
      .ilike('company_name', orgId)
      .limit(1);
    const org = Array.isArray(orgList) && orgList.length > 0 ? orgList[0] : null;
    if (!org?.id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 401 });
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, email, pin_hash, role')
      .eq('organization_id', org.id)
      .ilike('name', name)
      .limit(1)
      .maybeSingle();

    if (userError || !user?.pin_hash) {
      return NextResponse.json({ error: 'User not found or invalid credentials' }, { status: 401 });
    }

    const valid = await verifyPin(pin, user.pin_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
    }

    const role = (user as { role?: string }).role ?? 'staff';
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role,
        organization_id: org.id,
      },
      organization_id: org.id,
      login_timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
