/** Matches server logic in /api/day-tasks GET for which tasks appear on a calendar day. */
export type DayTaskRow = {
  id: string;
  user_id: string;
  task_date: string;
  title: string;
  completed: boolean;
  notes: string | null;
  frequency?: string | null;
  created_at?: string;
};

export function dayTasksVisibleOnDate(allTasks: DayTaskRow[], dateYmd: string): DayTaskRow[] {
  const targetDate = new Date(dateYmd + 'T12:00:00');
  const targetDay = targetDate.getDay();
  const targetDateNum = targetDate.getDate();

  return allTasks.filter((task) => {
    if (task.task_date > dateYmd) return false;
    const taskDate = new Date(task.task_date + 'T12:00:00');
    const freq = task.frequency || 'once';

    if (freq === 'once') return task.task_date === dateYmd;
    if (freq === 'daily') return true;
    if (freq === 'weekly') return taskDate.getDay() === targetDay;
    if (freq === 'monthly') return taskDate.getDate() === targetDateNum;
    return task.task_date === dateYmd;
  });
}

export function countDayTasksByDate(allTasks: DayTaskRow[], fromYmd: string, toYmd: string): Map<string, number> {
  const map = new Map<string, number>();
  const from = new Date(fromYmd + 'T12:00:00');
  const to = new Date(toYmd + 'T12:00:00');
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const key = `${y}-${m}-${day}`;
    const n = dayTasksVisibleOnDate(allTasks, key).length;
    if (n > 0) map.set(key, n);
  }
  return map;
}
