import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

/** GET /api/auth/users?slug= — public list of users for login avatar picker (no secrets). */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = (searchParams.get('slug') ?? '').trim().toLowerCase();
    if (!slug) {
      return NextResponse.json({ error: 'slug required' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { data: org } = await supabase.from('organization').select('id').eq('slug', slug).maybeSingle();
    if (!org?.id) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, role')
      .eq('organization_id', org.id)
      .order('role', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const list = (users ?? []).map((u) => ({
      id: u.id as string,
      name: (u as { name?: string | null }).name ?? 'Unnamed',
      role: (u as { role?: string }).role === 'admin' ? 'admin' : 'staff',
    }));

    return NextResponse.json({ users: list });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
