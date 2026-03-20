'use client';

import { useAuth } from '@/contexts/AuthContext';
import DashboardCalendar from '@/components/dashboard/DashboardCalendar';
import { WidgetSkeleton } from '@/components/ui/Skeleton';
import { useTasks } from '@/hooks/use-tasks';

export default function CalendarPage() {
  const { user } = useAuth();
  const { tasks, isLoading } = useTasks(user?.id);

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col gap-4 overflow-hidden">
      <header>
        <h1 className="text-xl font-bold text-slate-800">Calendar</h1>
        <p className="text-slate-500 text-sm">View your schedule and tasks</p>
      </header>
      <div className="flex-1 min-h-0">
        {isLoading ? <WidgetSkeleton /> : <DashboardCalendar userId={user?.id} tasks={tasks} />}
      </div>
    </div>
  );
}
