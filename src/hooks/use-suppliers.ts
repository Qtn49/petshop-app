import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type SupplierLink = {
  id: string;
  name: string;
  url: string;
};

const SUPPLIERS_KEY = 'suppliers';

async function fetchSuppliers(userId: string): Promise<SupplierLink[]> {
  const res = await fetch(`/api/suppliers?userId=${userId}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.links ?? [];
}

export function useSuppliers(userId?: string) {
  const qc = useQueryClient();
  const queryKey = [SUPPLIERS_KEY, userId];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchSuppliers(userId!),
    enabled: !!userId,
  });

  const addLink = useMutation({
    mutationFn: async (link: { name: string; url: string }) => {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name: link.name, url: link.url }),
      });
      return res.json();
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<SupplierLink[]>(queryKey) ?? [];
      const optimistic: SupplierLink = { id: crypto.randomUUID(), name: vars.name, url: vars.url };
      qc.setQueryData<SupplierLink[]>(queryKey, [optimistic, ...prev]);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey }),
  });

  const deleteLink = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/suppliers/${id}`, { method: 'DELETE' });
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<SupplierLink[]>(queryKey) ?? [];
      qc.setQueryData<SupplierLink[]>(queryKey, prev.filter((l) => l.id !== id));
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev);
    },
  });

  return {
    links: query.data ?? [],
    isLoading: query.isLoading,
    addLink,
    deleteLink,
  };
}
