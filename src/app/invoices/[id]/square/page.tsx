'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Loader2, Check, AlertCircle, Link2, ArrowRight } from 'lucide-react';
import { getConfirmItemsKey } from '@/lib/invoice-import/steps';
import type { ConfirmItem } from '@/lib/invoice-import/confirm-types';

type InvoiceItem = {
  id?: string;
  product_name: string;
  quantity: number;
  price?: number;
  calculated_price?: number | null;
  in_purchase_order?: boolean;
};

type CatalogItem = {
  id: string;
  name: string;
  variations?: { id: string; name: string; price?: number }[];
};

type MatchedItem = {
  product_name: string;
  quantity: number;
  price?: number;
  calculated_price?: number | null;
  /** Sale price: from Square when matched, from calculated_price when unmatched */
  salePrice?: number | null;
  catalogItemId?: string;
  catalogVariationId?: string;
  catalogName?: string;
  status: 'matched' | 'unmatched';
  selected: boolean;
  invoice_item_id?: string;
  in_purchase_order?: boolean;
};

function toConfirmItem(item: MatchedItem): ConfirmItem {
  return {
    product_name: item.product_name,
    quantity: item.quantity,
    purchase_price: item.price != null ? Number(item.price) : null,
    retail_price: item.salePrice != null && !Number.isNaN(Number(item.salePrice)) ? Number(item.salePrice) : null,
    category: '',
    sku: '',
    vendor: '',
    vendor_code: '',
    image: null,
    initial_stock: item.quantity,
    status: item.status,
    catalogItemId: item.catalogItemId,
    catalogVariationId: item.catalogVariationId,
    catalogName: item.catalogName,
    invoice_item_id: item.invoice_item_id,
  };
}

export default function InvoiceSquarePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<MatchedItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [squareConnected, setSquareConnected] = useState(false);
  const [error, setError] = useState('');
  const [reconnectHint, setReconnectHint] = useState<string | null>(null);
  const [reenabling, setReenabling] = useState(false);

  const invoiceId = params.id as string;

  useEffect(() => {
    if (!invoiceId || !user?.id) {
      setLoading(false);
      return;
    }

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
          const isMatched = !!match;
          const salePrice = isMatched && variation?.price != null
            ? variation.price
            : (item.calculated_price != null && !Number.isNaN(Number(item.calculated_price))
              ? Number(item.calculated_price)
              : undefined);
          const inPO = Boolean((item as InvoiceItem).in_purchase_order);
          return {
            ...item,
            product_name: item.product_name,
            catalogItemId: match?.id,
            catalogVariationId: variation?.id,
            catalogName,
            salePrice: salePrice ?? null,
            status: isMatched ? 'matched' : 'unmatched',
            selected: !inPO,
            invoice_item_id: (item as InvoiceItem).id,
            in_purchase_order: inPO,
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
    const item = items[index];
    if (item?.in_purchase_order) return;
    setItems((prev) => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], selected: !next[index].selected };
      return next;
    });
  };

  const selectAll = () => {
    setItems((prev) => prev.map((i) => ({ ...i, selected: i.in_purchase_order ? i.selected : true })));
  };

  const deselectAll = () => {
    setItems((prev) => prev.map((i) => ({ ...i, selected: i.in_purchase_order ? i.selected : false })));
  };

  const hasItemsInPO = items.some((i) => i.in_purchase_order);
  const handleReenable = async () => {
    if (!user?.id) return;
    setReenabling(true);
    setError('');
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/items/reenable?userId=${encodeURIComponent(user.id)}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to re-enable');
      const [invRes] = await Promise.all([
        fetch(`/api/invoices/${invoiceId}?userId=${user.id}`),
        fetch(`/api/square/catalog?userId=${user.id}`),
      ]);
      const invData = await invRes.json();
      const invoiceItems: InvoiceItem[] = invData.items || [];
      const matched: MatchedItem[] = invoiceItems.map((item) => {
        const match = catalog.find(
          (c) =>
            c.name?.toLowerCase().includes(item.product_name.toLowerCase()) ||
            item.product_name.toLowerCase().includes(c.name?.toLowerCase() || '')
        );
        const variation = match?.variations?.[0];
        const catalogName = match?.name ?? undefined;
        const isMatched = !!match;
        const salePrice = isMatched && variation?.price != null
          ? variation.price
          : (item.calculated_price != null && !Number.isNaN(Number(item.calculated_price))
            ? Number(item.calculated_price)
            : undefined);
        const inPO = Boolean(item.in_purchase_order);
        return {
          ...item,
          product_name: item.product_name,
          catalogItemId: match?.id,
          catalogVariationId: variation?.id,
          catalogName,
          salePrice: salePrice ?? null,
          status: isMatched ? 'matched' : 'unmatched',
          selected: !inPO,
          invoice_item_id: item.id,
          in_purchase_order: inPO,
        } as MatchedItem;
      });
      setItems(matched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to re-enable items');
    } finally {
      setReenabling(false);
    }
  };

  const handleContinueToConfirmation = () => {
    const selectedItems = items.filter((i) => i.selected);
    if (selectedItems.length === 0) {
      setError('Select at least one item to continue.');
      return;
    }
    const payload: ConfirmItem[] = selectedItems.map(toConfirmItem);
    try {
      sessionStorage.setItem(getConfirmItemsKey(invoiceId), JSON.stringify(payload));
      router.push(`/invoices/${invoiceId}/confirm`);
    } catch {
      setError('Could not save selection. Try again.');
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

      <Card title="Items — Match with Square">
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
          Select the items you want to include. Then continue to confirm details and create the purchase order.
        </p>

        <div className="flex flex-wrap gap-2 mb-3">
          <Button variant="secondary" size="sm" onClick={selectAll} disabled={items.length === 0}>
            Select all
          </Button>
          <Button variant="secondary" size="sm" onClick={deselectAll} disabled={items.length === 0}>
            Deselect all
          </Button>
          {hasItemsInPO && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReenable}
              disabled={reenabling}
              className="text-amber-700 border-amber-300 hover:bg-amber-50"
            >
              {reenabling ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
              Re-enable items for purchase order
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="w-10 py-2 text-sm font-medium text-slate-600 text-center">Add</th>
                <th className="text-left py-2 text-sm font-medium text-slate-600">Product</th>
                <th className="text-left py-2 text-sm font-medium text-slate-600">Qty</th>
                <th className="text-left py-2 text-sm font-medium text-slate-600">Cost</th>
                <th className="text-left py-2 text-sm font-medium text-slate-600">Sale price</th>
                <th className="text-left py-2 text-sm font-medium text-slate-600">Match</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const inPO = item.in_purchase_order;
                return (
                  <tr
                    key={i}
                    role={inPO ? undefined : 'button'}
                    tabIndex={inPO ? undefined : 0}
                    onClick={() => !inPO && toggleSelected(i)}
                    onKeyDown={(e) => {
                      if (inPO) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSelected(i);
                      }
                    }}
                    className={`border-b border-slate-100 transition-colors ${
                      inPO ? 'bg-slate-50 opacity-75 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3 text-center">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        readOnly
                        disabled={inPO}
                        tabIndex={-1}
                        className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 pointer-events-none disabled:opacity-50"
                        title={inPO ? 'In purchase order — re-enable to add again' : item.status === 'matched' ? 'Already in Square' : 'Add to Square'}
                      />
                    </td>
                    <td className="py-3 text-slate-800">
                      <span className={inPO ? 'text-slate-500' : ''}>{item.product_name}</span>
                      {inPO && (
                        <span className="ml-2 text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800">In PO</span>
                      )}
                    </td>
                    <td className="py-3 text-slate-800">{item.quantity}</td>
                    <td className="py-3 text-slate-800">
                      {item.price != null ? `$${Number(item.price).toFixed(2)}` : '-'}
                    </td>
                    <td className="py-3 text-slate-800">
                      {item.salePrice != null && !Number.isNaN(item.salePrice)
                        ? `$${Number(item.salePrice).toFixed(2)}`
                        : '-'}
                    </td>
                    <td className="py-3">
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          item.status === 'matched'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.status === 'matched' ? 'Matched' : 'Not in Square'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex gap-4">
          <Button variant="secondary" onClick={() => router.back()}>
            Back
          </Button>
          <Button
            onClick={handleContinueToConfirmation}
            disabled={items.filter((i) => i.selected).length === 0}
          >
            <>
              <ArrowRight className="w-4 h-4 mr-2" />
              Continue to confirmation
            </>
          </Button>
        </div>
      </Card>
    </div>
  );
}
