'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardCalendar from '@/components/dashboard/DashboardCalendar';

type Task = { id: string; title: string; completed: boolean; due_date?: string | null };

export default function CalendarPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const res = await fetch(`/api/tasks?userId=${user.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.tasks?.length) setTasks(data.tasks);
        }
      } catch {
        // silent
      }
    })();
  }, [user?.id]);

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col gap-4 overflow-hidden">
      <header>
        <h1 className="text-xl font-bold text-slate-800">Calendar</h1>
        <p className="text-slate-500 text-sm">View your schedule and tasks</p>
      </header>
      <div className="flex-1 min-h-0">
        <DashboardCalendar userId={user?.id} tasks={tasks} />
      </div>
    </div>
  );
}
