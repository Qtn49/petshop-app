import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type Notification = {
  id: string;
  title: string;
  message: string | null;
  type: string;
  read: boolean;
};

const NOTIF_KEY = 'notifications';

async function fetchNotifications(userId: string): Promise<Notification[]> {
  const res = await fetch(`/api/notifications?userId=${userId}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.notifications ?? [];
}

export function useNotifications(userId?: string) {
  const qc = useQueryClient();
  const queryKey = [NOTIF_KEY, userId];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchNotifications(userId!),
    enabled: !!userId,
  });

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      });
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<Notification[]>(queryKey) ?? [];
      qc.setQueryData<Notification[]>(
        queryKey,
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev);
    },
  });

  const createNotification = useMutation({
    mutationFn: async (payload: { userId: string; title: string; message?: string; type?: string }) => {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return {
    notifications: query.data ?? [],
    isLoading: query.isLoading,
    markAsRead,
    createNotification,
  };
}
