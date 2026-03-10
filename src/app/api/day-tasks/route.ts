import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const date = searchParams.get('date');

  if (!userId || !date) {
    return NextResponse.json({ error: 'userId and date required' }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const { data: allTasks, error } = await supabase
    .from('day_tasks')
    .select('*')
    .eq('user_id', userId)
    .lte('task_date', date)
    .order('task_date', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const targetDate = new Date(date + 'T12:00:00');
  const targetDay = targetDate.getDay();
  const targetDateNum = targetDate.getDate();

  const tasksForDate = (allTasks || []).filter((task) => {
    const taskDate = new Date(task.task_date + 'T12:00:00');
    const freq = task.frequency || 'once';

    if (freq === 'once') return task.task_date === date;
    if (freq === 'daily') return true;
    if (freq === 'weekly') return taskDate.getDay() === targetDay;
    if (freq === 'monthly') return taskDate.getDate() === targetDateNum;
    return task.task_date === date;
  });

  tasksForDate.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return NextResponse.json({ tasks: tasksForDate });
}

export async function POST(request: Request) {
  const supabase = getSupabaseClient();
  const body = await request.json();
  const { userId, task_date, title, notes, frequency } = body;

  if (!userId || !task_date || !title) {
    return NextResponse.json(
      { error: 'userId, task_date, and title required' },
      { status: 400 }
    );
  }

  const validFreq = ['once', 'daily', 'weekly', 'monthly'].includes(frequency) ? frequency : 'once';

  const { data, error } = await supabase
    .from('day_tasks')
    .insert({
      user_id: userId,
      task_date,
      title,
      notes: notes || null,
      frequency: validFreq,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
