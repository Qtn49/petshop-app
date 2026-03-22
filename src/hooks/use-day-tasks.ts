import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import type { DayTaskRow } from '@/lib/day-tasks-calendar';

async function fetchDayTasksForMonth(userId: string, monthYm: string): Promise<DayTaskRow[]> {
  const res = await fetch(`/api/day-tasks/for-month?userId=${encodeURIComponent(userId)}&month=${encodeURIComponent(monthYm)}`);
  if (!res.ok) return [];
  const d = await res.json();
  return d.tasks ?? [];
}

async function fetchDayTasksForDate(userId: string, dateYmd: string): Promise<DayTaskRow[]> {
  const res = await fetch(`/api/day-tasks?userId=${encodeURIComponent(userId)}&date=${encodeURIComponent(dateYmd)}`);
  if (!res.ok) return [];
  const d = await res.json();
  return d.tasks ?? [];
}

export function useDayTasksForMonth(userId: string | undefined, month: Date) {
  const ym = format(month, 'yyyy-MM');
  return useQuery({
    queryKey: ['day-tasks-month', userId, ym],
    queryFn: () => fetchDayTasksForMonth(userId!, ym),
    enabled: !!userId,
  });
}

export function useDayTasksForDate(userId: string | undefined, selectedDate: Date | null) {
  const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  return useQuery({
    queryKey: ['day-tasks', userId, dateStr],
    queryFn: () => fetchDayTasksForDate(userId!, dateStr),
    enabled: !!userId && !!dateStr,
  });
}

export function useDayTaskMutations(userId: string | undefined) {
  const qc = useQueryClient();

  const invalidate = () => {
    if (!userId) return;
    void qc.invalidateQueries({ queryKey: ['day-tasks-month', userId] });
    void qc.invalidateQueries({ queryKey: ['day-tasks', userId] });
  };

  const toggleDayTask = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const res = await fetch(`/api/day-tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      });
      if (!res.ok) throw new Error('Failed');
    },
    onSettled: invalidate,
  });

  const deleteDayTask = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/day-tasks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
    },
    onSettled: invalidate,
  });

  const addDayTask = useMutation({
    mutationFn: async (vars: { task_date: string; title: string }) => {
      const res = await fetch('/api/day-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          task_date: vars.task_date,
          title: vars.title,
          frequency: 'once',
        }),
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSettled: invalidate,
  });

  return { toggleDayTask, deleteDayTask, addDayTask };
}
