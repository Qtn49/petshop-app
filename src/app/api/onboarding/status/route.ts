import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

/** GET: Check if the app has been configured (organization exists). */
export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('organization')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ configured: false });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ configured: !!data?.id });
  } catch {
    return NextResponse.json({ configured: false });
  }
}
