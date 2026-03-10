'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Loader2, Check, AlertCircle } from 'lucide-react';

type ParsedItem = {
  product_name: string;
  quantity: number;
  price?: number;
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [invoice, setInvoice] = useState<{
    id: string;
    file_name: string;
    status: string;
  } | null>(null);
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');

  const id = params.id as string;

  useEffect(() => {
    if (!id || !user?.id) return;

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/invoices/${id}?userId=${user.id}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Failed to load');

        setInvoice(data.invoice);
        setItems(data.items || []);

        if (data.invoice?.status === 'uploaded' && data.items?.length === 0) {
          setParsing(true);
          const parseRes = await fetch(`/api/invoices/parse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoiceId: id, userId: user.id }),
          });
          const parseData = await parseRes.json();
          if (parseRes.ok && parseData.items) {
            setItems(parseData.items);
            setInvoice((prev) => prev ? { ...prev, status: 'parsed' } : null);
          }
          setParsing(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, user?.id]);

  const handleConfirm = () => {
    router.push(`/invoices/${id}/square`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-slate-600">{error || 'Invoice not found'}</p>
        <Button className="mt-4" onClick={() => router.push('/invoices')}>
          Back to Invoices
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">Invoice: {invoice.file_name}</h1>
        <p className="text-slate-500 mt-1">Review and confirm parsed items</p>
      </header>

      {parsing ? (
        <Card>
          <div className="flex items-center gap-3 py-4">
            <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
            <span>Parsing invoice with AI...</span>
          </div>
        </Card>
      ) : (
        <Card title="Parsed Items">
          {items.length === 0 ? (
            <p className="text-slate-500">No items could be extracted. Please check the file.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 text-sm font-medium text-slate-600">Product</th>
                    <th className="text-left py-2 text-sm font-medium text-slate-600">Quantity</th>
                    <th className="text-left py-2 text-sm font-medium text-slate-600">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-3 text-slate-800">{item.product_name}</td>
                      <td className="py-3 text-slate-800">{item.quantity}</td>
                      <td className="py-3 text-slate-800">
                        {item.price != null ? `$${item.price.toFixed(2)}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6">
            <Button onClick={handleConfirm} disabled={items.length === 0}>
              <Check className="w-4 h-4 mr-2" />
              Confirm & Continue to Square
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
