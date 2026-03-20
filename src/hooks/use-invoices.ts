import { useQuery, useQueryClient } from '@tanstack/react-query';

export type InvoiceRow = {
  id: string;
  file_name: string;
  status: string;
  created_at: string;
};

const INVOICES_KEY = 'invoices';

async function fetchInvoices(userId: string): Promise<InvoiceRow[]> {
  const res = await fetch(`/api/invoices?userId=${userId}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.invoices ?? [];
}

export function useInvoices(userId?: string) {
  const qc = useQueryClient();
  const queryKey = [INVOICES_KEY, userId];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchInvoices(userId!),
    enabled: !!userId,
  });

  const removeOptimistic = (id: string) => {
    qc.setQueryData<InvoiceRow[]>(queryKey, (prev) =>
      prev?.filter((i) => i.id !== id) ?? []
    );
  };

  const invalidate = () => qc.invalidateQueries({ queryKey });

  return {
    invoices: query.data ?? [],
    isLoading: query.isLoading,
    removeOptimistic,
    invalidate,
  };
}
