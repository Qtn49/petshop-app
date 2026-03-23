'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { ListSkeleton } from '@/components/ui/Skeleton';
import InlineLoader from '@/components/ui/InlineLoader';
import { FileText, Trash2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { useInvoices } from '@/hooks/use-invoices';
import { useTenantHref } from '@/hooks/useTenantHref';

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full shrink-0">
        <CheckCircle2 className="w-3 h-3" />
        Completed
      </span>
    );
  }
  if (status === 'parsed') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
        <FileText className="w-3 h-3" />
        Ready
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full shrink-0">
        <AlertCircle className="w-3 h-3" />
        Error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full shrink-0">
      <Clock className="w-3 h-3" />
      {status}
    </span>
  );
}

export default function InvoicesListPage() {
  const tenantHref = useTenantHref();
  const { user } = useAuth();
  const { invoices, isLoading, removeOptimistic, invalidate } = useInvoices(user?.id);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRemove = async (inv: { id: string; file_name: string }) => {
    if (!user?.id || deletingId) return;
    if (!confirm(`Remove "${inv.file_name}"? This cannot be undone.`)) return;
    setError(null);
    setDeletingId(inv.id);
    removeOptimistic(inv.id);
    try {
      const res = await fetch(`/api/invoices/${inv.id}?userId=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to remove invoice');
      }
      invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove invoice');
      invalidate();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">Inventory</h1>
        <p className="text-slate-500 mt-1">All uploaded files</p>
      </header>

      <div className="flex gap-4">
        <Link href={tenantHref('/inventory')} className="text-primary-600 hover:underline">
          &larr; Upload new invoice
        </Link>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-800 text-sm">{error}</div>
      )}

      <Card title="Inventory List">
        {isLoading ? (
          <ListSkeleton rows={5} />
        ) : invoices.length === 0 ? (
          <p className="text-slate-500">No invoices yet.</p>
        ) : (
          <ul className="space-y-2">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 group">
                <Link href={tenantHref(`/inventory/${inv.id}`)} className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="w-5 h-5 text-slate-400 shrink-0" />
                  <span className="font-medium truncate">{inv.file_name}</span>
                  <StatusBadge status={inv.status} />
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    handleRemove(inv);
                  }}
                  disabled={deletingId !== null}
                  className="shrink-0 text-slate-400 hover:text-red-600"
                  title="Remove invoice"
                >
                  {deletingId === inv.id ? (
                    <InlineLoader size={24} />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
