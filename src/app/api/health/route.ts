import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

/**
 * GET /api/health — quick check if Supabase is connected.
 * Returns { supabase: "ok" } or { supabase: "error", message: "..." }.
 */
export async function GET() {
  const hasUrl = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co'
  );
  const hasKey = !!(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'placeholder')
  );

  if (!hasUrl || !hasKey) {
    return NextResponse.json(
      {
        supabase: 'error',
        message: 'Missing SUPABASE_URL or SUPABASE key in env',
      },
      { status: 503 }
    );
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error) {
      return NextResponse.json(
        { supabase: 'error', message: error.message },
        { status: 503 }
      );
    }
    return NextResponse.json({ supabase: 'ok' });
  } catch (err) {
    return NextResponse.json(
      {
        supabase: 'error',
        message: err instanceof Error ? err.message : 'Connection failed',
      },
      { status: 503 }
    );
  }
}
