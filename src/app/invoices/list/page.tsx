'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import { FileText } from 'lucide-react';

export default function InvoicesListPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<{ id: string; file_name: string; status: string; created_at: string }[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/invoices?userId=${user.id}`)
      .then((r) => r.json())
      .then((d) => setInvoices(d.invoices || []))
      .catch(() => setInvoices([]));
  }, [user?.id]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">Invoices</h1>
        <p className="text-slate-500 mt-1">All uploaded invoices</p>
      </header>

      <div className="flex gap-4">
        <Link href="/invoices" className="text-primary-600 hover:underline">
          ← Upload new invoice
        </Link>
      </div>

      <Card title="Invoice List">
        {invoices.length === 0 ? (
          <p className="text-slate-500">No invoices yet.</p>
        ) : (
          <ul className="space-y-2">
            {invoices.map((inv) => (
              <li key={inv.id}>
                <Link
                  href={`/invoices/${inv.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50"
                >
                  <FileText className="w-5 h-5 text-slate-400" />
                  <span className="flex-1 font-medium">{inv.file_name}</span>
                  <span className="text-sm text-slate-500">{inv.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
