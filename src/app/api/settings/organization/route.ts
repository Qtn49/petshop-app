import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

type Body = {
  company_name?: string;
  address?: string;
  email?: string;
  phone?: string;
  currency?: string;
};

/** GET: Return the current user's organization (for settings). */
export async function GET(request: Request) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    const { data: user } = await supabase.from('users').select('organization_id').eq('id', userId).single();
    if (!user?.organization_id) return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });

    const { data, error } = await supabase
      .from('organization')
      .select('id, company_name, address, email, phone, currency')
      .eq('id', user.organization_id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/** PATCH: Update the current user's organization. */
export async function PATCH(request: Request) {
  try {
    const supabase = getSupabaseClient();
    const body = (await request.json()) as Body & { userId?: string };
    const userId = body.userId;
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    const { data: user } = await supabase.from('users').select('organization_id').eq('id', userId).single();
    if (!user?.organization_id) return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.company_name !== undefined) updates.company_name = (body.company_name ?? '').trim();
    if (body.address !== undefined) updates.address = (body.address ?? '').trim() || null;
    if (body.email !== undefined) updates.email = (body.email ?? '').trim() || null;
    if (body.phone !== undefined) updates.phone = (body.phone ?? '').trim() || null;
    if (body.currency !== undefined) updates.currency = (body.currency ?? 'AUD').trim() || 'AUD';

    const { data, error } = await supabase
      .from('organization')
      .update(updates)
      .eq('id', user.organization_id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
