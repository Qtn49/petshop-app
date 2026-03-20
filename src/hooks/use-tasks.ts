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
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, title: task.title, dueDate: task.dueDate }),
      });
      return res.json();
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<Task[]>(queryKey) ?? [];
      const optimistic: Task = {
        id: crypto.randomUUID(),
        title: vars.title,
        completed: false,
        due_date: vars.dueDate ?? null,
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
