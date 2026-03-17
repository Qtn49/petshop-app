'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import TodoList from '@/components/dashboard/TodoList';

type Task = { id: string; title: string; completed: boolean; due_date?: string | null };

export default function TasksPage() {
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
        <h1 className="text-xl font-bold text-slate-800">To-Do List</h1>
        <p className="text-slate-500 text-sm">Manage your tasks</p>
      </header>
      <div className="flex-1 min-h-0">
        <TodoList tasks={tasks} onTasksChange={setTasks} userId={user?.id} />
      </div>
    </div>
  );
}
