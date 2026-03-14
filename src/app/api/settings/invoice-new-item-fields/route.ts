import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

const DEFAULT_NEW_ITEM_FIELDS = ['category', 'retail_price', 'sku', 'description', 'image'];

/** GET: Return enabled new item field IDs for the current user's organization (Step 3 confirm). */
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
      .select('invoice_new_item_fields')
      .eq('id', user.organization_id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const arr = data?.invoice_new_item_fields;
    const enabledFields = Array.isArray(arr) && arr.length > 0 ? arr : DEFAULT_NEW_ITEM_FIELDS;
    return NextResponse.json({ enabledFields });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
