import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { hashPin, validatePinFormat } from '@/lib/auth/pin';

/**
 * GET: List users.
 * - ?userId=xxx (settings): return users in the same organization as that user.
 * - No query (login): return all users with organization_id and organization name for display.
 */
export async function GET(request: Request) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (userId) {
      const { data: currentUser, error: userError } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', userId)
        .single();
      if (userError || !currentUser?.organization_id) {
        return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
      }
      const { data, error } = await supabase
        .from('users')
        .select('id, name, role')
        .eq('organization_id', currentUser.organization_id)
        .order('name');
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ users: data ?? [] });
    }

    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, role, organization_id')
      .order('name');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const orgIds = Array.from(new Set((users ?? []).map((u) => (u as { organization_id?: string }).organization_id).filter(Boolean))) as string[];
    const { data: orgs } = await supabase.from('organization').select('id, company_name').in('id', orgIds);
    const orgMap = new Map((orgs ?? []).map((o) => [o.id, o.company_name ?? '']));

    const list = (users ?? []).map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      organization_id: (u as { organization_id?: string }).organization_id,
      organization_name: orgMap.get((u as { organization_id?: string }).organization_id ?? '') ?? '',
    }));
    return NextResponse.json({ users: list });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

type PostBody = { name: string; pin: string; role?: 'admin' | 'staff'; userId: string };

/** POST: Create user (from settings). Attaches to the same organization as userId (current user). */
export async function POST(request: Request) {
  try {
    const supabase = getSupabaseClient();
    const body = (await request.json()) as PostBody;
    const currentUserId = body.userId;
    if (!currentUserId) return NextResponse.json({ error: 'userId (current user) is required' }, { status: 400 });
    const name = (body.name ?? '').trim();
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
    if (!validatePinFormat(body.pin ?? '')) {
      return NextResponse.json({ error: 'PIN must be 4 to 6 digits' }, { status: 400 });
    }
    const role = body.role === 'admin' ? 'admin' : 'staff';

    const { data: currentUser, error: currentError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', currentUserId)
      .single();
    if (currentError || !currentUser?.organization_id) {
      return NextResponse.json({ error: 'Current user or organization not found' }, { status: 404 });
    }

    const pin_hash = await hashPin(body.pin);
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        organization_id: currentUser.organization_id,
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
