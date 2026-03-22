import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type Task = {
  id: string;
  title: string;
  completed: boolean;
  due_date?: string | null;
};

const TASKS_KEY = 'tasks';

async function fetchTasks(userId: string): Promise<Task[]> {
  const res = await fetch(`/api/tasks?userId=${userId}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.tasks ?? [];
}

export function useTasks(userId?: string) {
  const qc = useQueryClient();
  const queryKey = [TASKS_KEY, userId];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchTasks(userId!),
    enabled: !!userId,
  });

  const addTask = useMutation({
    mutationFn: async (task: { title: string; dueDate?: string | null }) => {
      if (task.dueDate) {
        const res = await fetch('/api/day-tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            task_date: task.dueDate,
            title: task.title,
            frequency: 'once',
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || 'Failed to add calendar task');
        }
        await qc.invalidateQueries({ queryKey: ['day-tasks-month', userId] });
        await qc.invalidateQueries({ queryKey: ['day-tasks', userId] });
        return res.json();
      }
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, title: task.title }),
      });
      if (!res.ok) throw new Error('Failed to add task');
      return res.json();
    },
    onMutate: async (vars) => {
      if (vars.dueDate) return { prev: undefined as Task[] | undefined };
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<Task[]>(queryKey) ?? [];
      const optimistic: Task = {
        id: crypto.randomUUID(),
        title: vars.title,
        completed: false,
        due_date: null,
      };
      qc.setQueryData<Task[]>(queryKey, [...prev, optimistic]);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey }),
  });

  const toggleTask = useMutation({
    mutationFn: async (id: string) => {
      const tasks = qc.getQueryData<Task[]>(queryKey) ?? [];
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !task.completed }),
      });
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<Task[]>(queryKey) ?? [];
      qc.setQueryData<Task[]>(
        queryKey,
        prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev);
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<Task[]>(queryKey) ?? [];
      qc.setQueryData<Task[]>(queryKey, prev.filter((t) => t.id !== id));
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev);
    },
  });

  return {
    tasks: query.data ?? [],
    isLoading: query.isLoading,
    addTask,
    toggleTask,
    deleteTask,
  };
}
