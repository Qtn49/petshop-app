'use client';

import { useAuth } from '@/contexts/AuthContext';
import TodoList from '@/components/dashboard/TodoList';
import { WidgetSkeleton } from '@/components/ui/Skeleton';
import { useTasks } from '@/hooks/use-tasks';

export default function TasksPage() {
  const { user } = useAuth();
  const uid = user?.id;
  const { tasks, isLoading, addTask, toggleTask, deleteTask } = useTasks(uid);

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col gap-4 overflow-hidden">
      <header>
        <h1 className="text-xl font-bold text-slate-800">To-Do List</h1>
        <p className="text-slate-500 text-sm">Manage your tasks</p>
      </header>
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <WidgetSkeleton />
        ) : (
          <TodoList
            tasks={tasks}
            onAddTask={(title, dueDate) => addTask.mutate({ title, dueDate })}
            onToggleTask={(id) => toggleTask.mutate(id)}
            onDeleteTask={(id) => deleteTask.mutate(id)}
            userId={uid}
          />
        )}
      </div>
    </div>
  );
}
