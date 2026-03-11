'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Loader2, Check, AlertCircle, Link2 } from 'lucide-react';

type InvoiceItem = {
  id?: string;
  product_name: string;
  quantity: number;
  price?: number;
};

type CatalogItem = {
  id: string;
  name: string;
  variations?: { id: string; name: string }[];
};

type MatchedItem = {
  product_name: string;
  quantity: number;
  price?: number;
  catalogItemId?: string;
  catalogVariationId?: string;
  catalogName?: string;
  status: 'matched' | 'unmatched';
  selected: boolean;
};

export default function InvoiceSquarePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<MatchedItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [squareConnected, setSquareConnected] = useState(false);
  const [error, setError] = useState('');
  const [reconnectHint, setReconnectHint] = useState<string | null>(null);

  const invoiceId = params.id as string;

  useEffect(() => {
    if (!invoiceId || !user?.id) return;

    const fetchData = async () => {
      try {
        const [invRes, catRes] = await Promise.all([
          fetch(`/api/invoices/${invoiceId}?userId=${user.id}`),
          fetch(`/api/square/catalog?userId=${user.id}`),
        ]);

        const invData = await invRes.json();
        const catData = await catRes.json();

        if (!invRes.ok) throw new Error(invData.error || 'Failed to load invoice');

        const invoiceItems: InvoiceItem[] = invData.items || [];
        const catalogItems: CatalogItem[] = catData.items || [];

        setSquareConnected(catRes.ok && !catData.error);

        const matched: MatchedItem[] = invoiceItems.map((item) => {
          const match = catalogItems.find(
            (c) =>
              c.name?.toLowerCase().includes(item.product_name.toLowerCase()) ||
              item.product_name.toLowerCase().includes(c.name?.toLowerCase() || '')
          );
          const variation = match?.variations?.[0];
          const catalogName = match?.name ?? undefined;
          return {
            ...item,
            product_name: catalogName ? catalogName : item.product_name,
            catalogItemId: match?.id,
            catalogVariationId: variation?.id,
            catalogName,
            status: match ? 'matched' : 'unmatched',
            selected: true,
          } as MatchedItem;
        });
        setItems(matched);
        setCatalog(catalogItems);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [invoiceId, user?.id]);

  const toggleSelected = (index: number) => {
    setItems((prev) => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], selected: !next[index].selected };
      return next;
    });
  };

  const selectAll = () => {
    setItems((prev) => prev.map((i) => ({ ...i, selected: true })));
  };

  const deselectAll = () => {
    setItems((prev) => prev.map((i) => ({ ...i, selected: false })));
  };

  const handleAddToSquare = async () => {
    if (!user?.id) return;

    const selectedItems = items.filter((i) => i.selected);
    const toCreate = selectedItems.filter((i) => i.status === 'unmatched');

    if (toCreate.length === 0) {
      const allMatched = selectedItems.length > 0 && selectedItems.every((i) => i.status === 'matched');
      if (allMatched) {
        setError('All selected items are already in your Square catalog. No new items to add.');
      } else {
        setError('Select at least one item that is not yet in Square to add.');
      }
      return;
    }

    setCreating(true);
    setError('');
    setReconnectHint(null);

    try {
      const res = await fetch('/api/square/catalog/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          items: toCreate.map((i) => ({
            product_name: i.product_name,
            quantity: i.quantity,
            price: i.price,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to add items to Square');

      if (data.hint) {
        setReconnectHint(data.hint);
      }
      if (data.errors?.length) {
        setError(`Added ${data.created?.length ?? 0} item(s). Some failed: ${data.errors.map((e: { name: string; error: string }) => `${e.name}: ${e.error}`).join('; ')}`);
      }
      if (data.created?.length && !data.errors?.length) {
        setError('');
        router.push(`/invoices/${invoiceId}?square_added=1`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to Square');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-slate-600">{error}</p>
        <Button className="mt-4" onClick={() => router.push('/invoices')}>
          Back to Invoices
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">Square Review</h1>
        <p className="text-slate-500 mt-1">Match items and create purchase order</p>
      </header>

      {!squareConnected && (
        <Card>
          <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-amber-800">Connect Square</p>
              <p className="text-sm text-amber-700">
                Connect your Square account to match products and create purchase orders.
              </p>
              <a
                href={`/api/square/connect?userId=${user?.id}`}
                className="inline-flex items-center gap-2 mt-2 text-primary-600 font-medium"
              >
                <Link2 className="w-4 h-4" />
                Connect Square
              </a>
            </div>
          </div>
        </Card>
      )}

      <Card title="Items — Add to Square">
        {reconnectHint && (
          <div className="mb-4 p-4 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-amber-800 font-medium">{reconnectHint}</p>
            <a href="/settings" className="inline-flex items-center gap-2 mt-2 text-primary-600 font-medium hover:underline">
              <Link2 className="w-4 h-4" />
              Open Settings to reconnect Square
            </a>
          </div>
        )}
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <p className="text-slate-600 text-sm mb-4">
          Check the items you want to add to Square. Only items not already in your catalog will be created. Purchase order is not created.
        </p>

        <div className="flex gap-2 mb-3">
          <Button variant="secondary" size="sm" onClick={selectAll} disabled={items.length === 0}>
            Select all
          </Button>
          <Button variant="secondary" size="sm" onClick={deselectAll} disabled={items.length === 0}>
            Deselect all
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="w-10 py-2 text-sm font-medium text-slate-600 text-center">Add</th>
                <th className="text-left py-2 text-sm font-medium text-slate-600">Product</th>
                <th className="text-left py-2 text-sm font-medium text-slate-600">Qty</th>
                <th className="text-left py-2 text-sm font-medium text-slate-600">Price</th>
                <th className="text-left py-2 text-sm font-medium text-slate-600">Match</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr
                  key={i}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleSelected(i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleSelected(i);
                    }
                  }}
                  className="border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <td className="py-3 text-center">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      readOnly
                      tabIndex={-1}
                      className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 pointer-events-none"
                      title={item.status === 'matched' ? 'Already in Square' : 'Add to Square'}
                    />
                  </td>
                  <td className="py-3 text-slate-800">{item.product_name}</td>
                  <td className="py-3 text-slate-800">{item.quantity}</td>
                  <td className="py-3 text-slate-800">
                    {item.price != null ? `$${Number(item.price).toFixed(2)}` : '-'}
                  </td>
                  <td className="py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        item.status === 'matched'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.status === 'matched' ? item.catalogName || 'Matched' : 'Not in Square'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex gap-4">
          <Button variant="secondary" onClick={() => router.back()}>
            Back
          </Button>
          <Button
            onClick={handleAddToSquare}
            disabled={creating || items.filter((i) => i.selected && i.status === 'unmatched').length === 0}
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Add selected to Square
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
