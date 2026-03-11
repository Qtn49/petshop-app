'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Loader2, Check, AlertCircle, Pencil } from 'lucide-react';

type ParsedItem = {
  product_name: string;
  quantity: number;
  price?: number;
};

type CatalogItem = { id: string; name: string };
type EditingCell = { index: number; field: 'name' | 'quantity' } | null;

function matchCatalogName(productName: string, catalogItems: CatalogItem[]): string | null {
  const match = catalogItems.find(
    (c) =>
      c.name?.toLowerCase().includes(productName.toLowerCase()) ||
      productName.toLowerCase().includes(c.name?.toLowerCase() || '')
  );
  return match?.name ?? null;
}

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
  const [editing, setEditing] = useState<EditingCell>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const id = params.id as string;

  const applyCatalogCorrection = useCallback((currentItems: ParsedItem[]) => {
    if (!user?.id || currentItems.length === 0) return;
    fetch(`/api/square/catalog?userId=${user.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error || !Array.isArray(data.items)) return;
        const catalogItems: CatalogItem[] = data.items;
        const corrected = currentItems.map((item) => {
          const catalogName = matchCatalogName(item.product_name, catalogItems);
          return catalogName
            ? { ...item, product_name: catalogName }
            : item;
        });
        setItems(corrected);
      })
      .catch(() => {});
  }, [user?.id]);

  const startEdit = (index: number, field: 'name' | 'quantity') => {
    const item = items[index];
    if (!item) return;
    setEditing({ index, field });
    setEditValue(field === 'name' ? item.product_name : String(item.quantity));
  };

  const saveEdit = () => {
    if (editing == null) return;
    const { index, field } = editing;
    if (field === 'name' && editValue.trim() === '') {
      cancelEdit();
      return;
    }
    if (field === 'quantity') {
      const qty = parseInt(editValue, 10);
      if (Number.isNaN(qty) || qty <= 0) {
        cancelEdit();
        return;
      }
    }
    setItems((prev) => {
      const next = [...prev];
      const item = next[index];
      if (!item) return prev;
      if (field === 'name') {
        next[index] = { ...item, product_name: editValue.trim() };
      } else {
        const qty = parseInt(editValue, 10);
        if (!Number.isNaN(qty) && qty > 0) {
          next[index] = { ...item, quantity: qty };
        }
      }
      return next;
    });
    setEditing(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValue('');
  };

  useEffect(() => {
    if (!id || !user?.id) return;

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/invoices/${id}?userId=${user.id}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Failed to load');

        setInvoice(data.invoice);
        const initialItems = data.items || [];
        setItems(initialItems);
        if (initialItems.length > 0) applyCatalogCorrection(initialItems);

        if (data.invoice?.status === 'uploaded' && (data.items?.length ?? 0) === 0) {
          setParsing(true);
          setError('');
          try {
            const parseRes = await fetch(`/api/invoices/parse`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ invoiceId: id, userId: user.id }),
            });
            const parseData = await parseRes.json();
            if (parseRes.ok && parseData.items?.length) {
              const parsedItems = parseData.items;
              setItems(parsedItems);
              applyCatalogCorrection(parsedItems);
              setInvoice((prev) => prev ? { ...prev, status: 'parsed' } : null);
            } else if (!parseRes.ok) {
              setError(parseData.error || 'Parsing failed');
            }
          } finally {
            setParsing(false);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, user?.id, applyCatalogCorrection]);

  const handleConfirm = async () => {
    if (!user?.id || items.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/invoices/${id}?userId=${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({
            product_name: item.product_name,
            quantity: item.quantity,
            price: item.price,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to save items');
        return;
      }
      router.push(`/invoices/${id}/square`);
    } catch {
      setError('Failed to save items');
    } finally {
      setSaving(false);
    }
  };

  const handleParseAgain = async () => {
    if (!user?.id) return;
    setParsing(true);
    setError('');
    try {
      const parseRes = await fetch(`/api/invoices/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: id, userId: user.id }),
      });
      const parseData = await parseRes.json();
      if (parseRes.ok && parseData.items?.length) {
        const parsedItems = parseData.items;
        setItems(parsedItems);
        applyCatalogCorrection(parsedItems);
        setInvoice((prev) => prev ? { ...prev, status: 'parsed' } : null);
      } else if (!parseRes.ok) {
        setError(parseData.error || 'Parsing failed');
      }
    } finally {
      setParsing(false);
    }
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
          {error && (
            <p className="text-red-500 text-sm mb-4">{error}</p>
          )}
          {items.length === 0 ? (
            <div className="space-y-3">
              <p className="text-slate-500">No items could be extracted. Check the file or retry. Logs appear in the terminal where you run <code className="bg-slate-100 px-1 rounded">npm run dev</code>.</p>
              <Button variant="secondary" onClick={handleParseAgain} disabled={parsing}>
                {parsing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Parsing...</> : 'Parse again'}
              </Button>
            </div>
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
                      <td className="py-3 text-slate-800">
                        {editing?.index === i && editing?.field === 'name' ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit();
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            className="w-full max-w-md px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none"
                            autoFocus
                          />
                        ) : (
                          <span className="flex items-center gap-2">
                            {item.product_name}
                            <button
                              type="button"
                              onClick={() => startEdit(i, 'name')}
                              className="p-1 rounded text-slate-400 hover:text-primary-600 hover:bg-slate-100"
                              title="Edit name"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-slate-800">
                        {editing?.index === i && editing?.field === 'quantity' ? (
                          <input
                            type="number"
                            min={1}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit();
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            className="w-20 px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none"
                            autoFocus
                          />
                        ) : (
                          <span className="flex items-center gap-2">
                            {item.quantity}
                            <button
                              type="button"
                              onClick={() => startEdit(i, 'quantity')}
                              className="p-1 rounded text-slate-400 hover:text-primary-600 hover:bg-slate-100"
                              title="Edit quantity"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-slate-800">
                        {item.price != null ? `$${Number(item.price).toFixed(2)}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6">
            <Button onClick={handleConfirm} disabled={items.length === 0 || saving}>
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                <><Check className="w-4 h-4 mr-2" /> Confirm & Continue to Square</>
              )}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
