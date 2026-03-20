'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { FileText, Trash2, Loader2 } from 'lucide-react';
import { useInvoices } from '@/hooks/use-invoices';

export default function InvoicesListPage() {
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
        <h1 className="text-2xl font-bold text-slate-800">Invoices</h1>
        <p className="text-slate-500 mt-1">All uploaded invoices</p>
      </header>

      <div className="flex gap-4">
        <Link href="/invoices" className="text-primary-600 hover:underline">
          &larr; Upload new invoice
        </Link>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-800 text-sm">{error}</div>
      )}

      <Card title="Invoice List">
        {isLoading ? (
          <ListSkeleton rows={5} />
        ) : invoices.length === 0 ? (
          <p className="text-slate-500">No invoices yet.</p>
        ) : (
          <ul className="space-y-2">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 group">
                <Link href={`/invoices/${inv.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="w-5 h-5 text-slate-400 shrink-0" />
                  <span className="font-medium truncate">{inv.file_name}</span>
                  <span className="text-sm text-slate-500 shrink-0">{inv.status}</span>
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
                    <Loader2 className="w-4 h-4 animate-spin" />
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
