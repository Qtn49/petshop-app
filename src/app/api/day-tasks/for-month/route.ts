import { NextResponse } from 'next/server';
import { endOfMonth, format } from 'date-fns';
import { getSupabaseClient } from '@/lib/supabase-server';

/** All day_tasks rows that can affect the given month (same filter basis as single-day GET). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const month = searchParams.get('month'); // yyyy-MM

  if (!userId || !month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'userId and month (yyyy-MM) required' }, { status: 400 });
  }

  const [y, m] = month.split('-').map(Number);
  const end = endOfMonth(new Date(y, m - 1, 1));
  const endStr = format(end, 'yyyy-MM-dd');

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('day_tasks')
    .select('*')
    .eq('user_id', userId)
    .lte('task_date', endStr)
    .order('task_date', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tasks: data ?? [] });
}
