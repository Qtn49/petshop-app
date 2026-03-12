import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { hashPin, validatePinFormat } from '@/lib/auth/pin';

/** PATCH: Update user (name, role, or PIN). Caller must be in the same organization. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();
    const body = await request.json() as { name?: string; role?: string; pin?: string; userId: string };
    const currentUserId = body.userId;
    if (!currentUserId) return NextResponse.json({ error: 'userId (current user) is required' }, { status: 400 });

    const { data: currentUser } = await supabase.from('users').select('organization_id').eq('id', currentUserId).single();
    const { data: targetUser } = await supabase.from('users').select('id, organization_id').eq('id', id).single();
    if (!targetUser || currentUser?.organization_id !== targetUser.organization_id) {
      return NextResponse.json({ error: 'User not found or access denied' }, { status: 404 });
    }

    if (body.name !== undefined) {
      const name = (body.name ?? '').trim();
      if (!name) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 });
      const { error } = await supabase
        .from('users')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (body.role === 'admin' || body.role === 'staff') {
      const { error } = await supabase
        .from('users')
        .update({ role: body.role, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (body.pin !== undefined && body.pin !== '') {
      if (!validatePinFormat(body.pin)) {
        return NextResponse.json({ error: 'PIN must be 4 to 6 digits' }, { status: 400 });
      }
      const pin_hash = await hashPin(body.pin);
      const { error } = await supabase
        .from('users')
        .update({ pin_hash, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, role')
      .eq('id', id)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/** DELETE: Remove user. Caller must be in the same organization. Fails if it would leave zero admins in that org. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const currentUserId = searchParams.get('userId');
    if (!currentUserId) return NextResponse.json({ error: 'userId (current user) is required' }, { status: 400 });

    const { data: currentUser } = await supabase.from('users').select('organization_id').eq('id', currentUserId).single();
    const { data: toDelete } = await supabase.from('users').select('id, role, organization_id').eq('id', id).single();
    if (!toDelete) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (currentUser?.organization_id !== (toDelete as { organization_id?: string }).organization_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    if (toDelete.role === 'admin') {
      const orgId = (toDelete as { organization_id?: string }).organization_id;
      const { count } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin')
        .eq('organization_id', orgId);
      if ((count ?? 0) <= 1) {
        return NextResponse.json({ error: 'At least one admin must exist in this organization' }, { status: 400 });
      }
    }

    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
