'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { getConfirmItemsKey } from '@/lib/invoice-import/steps';
import type { ConfirmItem, RequiredField } from '@/lib/invoice-import/confirm-types';
import { getMissingFields } from '@/lib/invoice-import/confirm-types';
import ProductCard from '@/components/invoice-import/ProductCard';
import PurchaseOrderSummary from '@/components/invoice-import/PurchaseOrderSummary';

export default function InvoiceConfirmPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const invoiceId = params.id as string;
  const [items, setItems] = useState<ConfirmItem[]>([]);
  const [squareCategories, setSquareCategories] = useState<string[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [squareItemFields, setSquareItemFields] = useState<{ id: string; name: string; optionValues?: { id: string; name: string }[] }[]>([]);
  const [squareAutocomplete, setSquareAutocomplete] = useState<Record<string, string[]>>({ product_name: [], sku: [] });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showValidation, setShowValidation] = useState(false);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!invoiceId) {
      setLoading(false);
      return;
    }
    try {
      const raw = sessionStorage.getItem(getConfirmItemsKey(invoiceId));
      if (!raw) {
        router.replace(`/invoices/${invoiceId}/square`);
        return;
      }
      const parsed = JSON.parse(raw) as ConfirmItem[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        router.replace(`/invoices/${invoiceId}/square`);
        return;
      }
      setItems(parsed.map((i) => ({ ...i, includedInPO: i.includedInPO !== false, images: i.images ?? [] })));
    } catch {
      router.replace(`/invoices/${invoiceId}/square`);
    } finally {
      setLoading(false);
    }
  }, [invoiceId, router]);

  useEffect(() => {
    if (!user?.id || items.length === 0) return;
    setCategoriesLoading(true);
    Promise.all([
      fetch(`/api/square/catalog/categories?userId=${encodeURIComponent(user.id)}`).then((r) => r.json()),
      fetch(`/api/square/catalog/autocomplete-values?userId=${encodeURIComponent(user.id)}`).then((r) => r.json()),
    ])
      .then(([categoriesData, valuesData]) => {
        if (Array.isArray(categoriesData.categories)) {
          setSquareCategories(categoriesData.categories);
          if (typeof console !== 'undefined' && console.log) {
            console.log('Category autocomplete (from GET /api/square/catalog/categories):', categoriesData.categories);
          }
        }
        const vals = valuesData?.values;
        if (vals && typeof vals === 'object') {
          const autocomplete = {
            product_name: Array.isArray(vals.product_name) ? vals.product_name : [],
            sku: Array.isArray(vals.sku) ? vals.sku : [],
            ...Object.fromEntries(
              Object.entries(vals)
                .filter(([k, v]) => k !== 'product_name' && k !== 'sku' && Array.isArray(v))
                .map(([k, v]) => [k, v])
            ),
          } as Record<string, string[]>;
          setSquareAutocomplete(autocomplete);
        }
        if (typeof console !== 'undefined' && console.log) {
          console.log('Vendor autocomplete: use Vendor field (focus it) → calls GET /api/vendors');
        }
      })
      .catch(() => {})
      .finally(() => setCategoriesLoading(false));
  }, [user?.id, items.length]);

  const fetchSquareItemFields = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/square/catalog/item-fields?userId=${encodeURIComponent(user.id)}`, { cache: 'no-store' });
      const data = res.ok ? await res.json() : null;
      if (data?.fields && Array.isArray(data.fields)) {
        setSquareItemFields(data.fields);
      }
    } catch {
      // ignore
    }
  }, [user?.id]);

  useEffect(() => {
    fetchSquareItemFields();
  }, [fetchSquareItemFields]);

  useEffect(() => {
    if (!user?.id) return;
    const onFocus = () => fetchSquareItemFields();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user?.id, fetchSquareItemFields]);

  const updateItem = useCallback((index: number, updates: Partial<ConfirmItem>) => {
    setItems((prev) => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], ...updates };
      return next;
    });
  }, []);

  const newProducts = items.filter((i) => i.status === 'unmatched');
  const existingProducts = items.filter((i) => i.status === 'matched');

  const includedItems = items.filter((i) => i.includedInPO !== false);

  const getAllMissing = useCallback((): { index: number; fields: RequiredField[] }[] => {
    const result: { index: number; fields: RequiredField[] }[] = [];
    items.forEach((item, index) => {
      if (item.includedInPO === false) return;
      const fields = getMissingFields(item);
      if (fields.length) result.push({ index, fields });
    });
    return result;
  }, [items]);

  const totalCost = includedItems.reduce(
    (sum, i) => sum + (i.purchase_price != null && !Number.isNaN(i.purchase_price) ? i.purchase_price * i.quantity : 0),
    0
  );
  const summaryVendor = includedItems[0]?.vendor ?? '';
  const summaryVendorCode = includedItems[0]?.vendor_code ?? '';

  const handleCreatePO = async () => {
    const missingPerItem = getAllMissing();
    if (missingPerItem.length > 0) {
      setShowValidation(true);
      setError('Please fill all required fields.');
      const first = missingPerItem[0];
      setTimeout(() => {
        const el = itemRefs.current[first.index];
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
      return;
    }
    if (!user?.id) return;
    if (includedItems.length === 0) {
      setError('Select at least one item to include in the purchase order.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      if (typeof console !== 'undefined' && console.log) {
        console.log('Submitting item draft (items):', includedItems.map((i) => ({ product_name: i.product_name, customAttributes: i.customAttributes })));
      }
      const res = await fetch('/api/invoices/purchase-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          invoiceId,
          items: includedItems,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to create purchase order');

      sessionStorage.removeItem(getConfirmItemsKey(invoiceId));
      router.push(`/invoices/${invoiceId}?po_created=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    router.push(`/invoices/${invoiceId}/square`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">Confirm Products & Create Purchase Order</h1>
        <p className="text-slate-500 mt-1">Review and complete product details, then create the purchase order.</p>
      </header>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {newProducts.length > 0 && (
        <Card title="1️⃣ New Products">
          <p className="text-sm text-slate-600 mb-4">Complete details and add an image for each new product.</p>
          <div className="space-y-4">
            {items.map(
              (item, i) =>
                item.status === 'unmatched' && (
                  <ProductCard
                    key={i}
                    item={item}
                    index={i}
                    missingFields={new Set(showValidation ? getMissingFields(item) : [])}
                    onChange={updateItem}
                    squareCategories={squareCategories}
                    categoryLoading={categoriesLoading}
                    disabled={submitting}
                    itemRef={(el) => { itemRefs.current[i] = el; }}
                    squareItemFields={squareItemFields}
                    squareAutocomplete={squareAutocomplete}
                    userId={user?.id}
                  />
                )
            )}
          </div>
        </Card>
      )}

      {existingProducts.length > 0 && (
        <Card title="2️⃣ Existing Products">
          <p className="text-sm text-slate-600 mb-4">Review and update details for products already in your catalog.</p>
          <div className="space-y-4">
            {items.map(
              (item, i) =>
                item.status === 'matched' && (
                  <ProductCard
                    key={i}
                    item={item}
                    index={i}
                    missingFields={new Set(showValidation ? getMissingFields(item) : [])}
                    onChange={updateItem}
                    squareCategories={squareCategories}
                    categoryLoading={categoriesLoading}
                    disabled={submitting}
                    itemRef={(el) => { itemRefs.current[i] = el; }}
                    squareItemFields={squareItemFields}
                    squareAutocomplete={squareAutocomplete}
                    userId={user?.id}
                  />
                )
            )}
          </div>
        </Card>
      )}

      <Card title="3️⃣ Purchase Order Summary">
        <PurchaseOrderSummary
          items={includedItems}
          vendor={summaryVendor}
          vendorCode={summaryVendorCode}
          totalCost={totalCost}
        />
        {includedItems.length < items.length && (
          <p className="text-sm text-slate-600 mt-2">
            {items.length - includedItems.length} item(s) not included in this purchase order.
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-4">
          <Button variant="secondary" onClick={handleBack} disabled={submitting}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={handleCreatePO}
            disabled={submitting || includedItems.length === 0}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Purchase Order'
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
