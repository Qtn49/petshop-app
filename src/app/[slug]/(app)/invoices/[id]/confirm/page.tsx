'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantHref } from '@/hooks/useTenantHref';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import InlineLoader from '@/components/ui/InlineLoader';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { getConfirmItemsKey } from '@/lib/invoice-import/steps';
import type { ConfirmItem, RequiredField } from '@/lib/invoice-import/confirm-types';
import { getMissingFields } from '@/lib/invoice-import/confirm-types';
import ProductCard from '@/components/invoice-import/ProductCard';
import PurchaseOrderSummary from '@/components/invoice-import/PurchaseOrderSummary';

type AiSuggestion = {
  name: string;
  suggested_price: number;
  confidence: 'high' | 'medium' | 'low';
  source: string;
};

export default function InvoiceConfirmPage() {
  const params = useParams();
  const router = useRouter();
  const tenantHref = useTenantHref();
  const { user } = useAuth();
  const invoiceId = params.id as string;
  const [items, setItems] = useState<ConfirmItem[]>([]);
  const [squareCategories, setSquareCategories] = useState<string[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [productNameOptionsLoading, setProductNameOptionsLoading] = useState(false);
  const [catalogItemsByName, setCatalogItemsByName] = useState<Record<string, { sku: string; category: string; description: string; vendor: string; vendor_code: string }>>({});
  const [squareItemFields, setSquareItemFields] = useState<{ id: string; name: string; optionValues?: { id: string; name: string }[] }[]>([]);
  const [squareAutocomplete, setSquareAutocomplete] = useState<Record<string, string[]>>({ product_name: [], sku: [] });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showValidation, setShowValidation] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [poVendorName, setPoVendorName] = useState('');
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // AI price suggestions state
  const [aiEnabled, setAiEnabled] = useState(false);
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [priceChoices, setPriceChoices] = useState<Record<number, 'ai' | 'formula'>>({});
  const formulaPricesRef = useRef<Record<number, number | null>>({});

  useEffect(() => {
    if (!invoiceId) {
      setLoading(false);
      return;
    }
    try {
      const raw = sessionStorage.getItem(getConfirmItemsKey(invoiceId));
      if (!raw) {
        router.replace(tenantHref(`/invoices/${invoiceId}/square`));
        return;
      }
      const parsed = JSON.parse(raw) as ConfirmItem[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        router.replace(tenantHref(`/invoices/${invoiceId}/square`));
        return;
      }
      const mapped = parsed.map((i) => ({ ...i, includedInPO: i.includedInPO !== false, images: i.images ?? [] }));
      setItems(mapped);
      // Capture original formula prices
      const fp: Record<number, number | null> = {};
      mapped.forEach((item, idx) => { fp[idx] = item.retail_price; });
      formulaPricesRef.current = fp;
    } catch {
      router.replace(tenantHref(`/invoices/${invoiceId}/square`));
    } finally {
      setLoading(false);
    }
  }, [invoiceId, router, tenantHref]);

  // Fetch org settings for ai_price_suggestions
  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/settings/organization?userId=${encodeURIComponent(user.id)}`)
      .then((r) => r.json())
      .then((data) => { if (data?.ai_price_suggestions) setAiEnabled(true); })
      .catch(() => {});
  }, [user?.id]);

  // Load categories first (lighter API). Load autocomplete-values and items-index in parallel (name options + lookup for "add as PO only").
  useEffect(() => {
    if (!user?.id || items.length === 0) return;
    setCategoriesLoading(true);
    setProductNameOptionsLoading(true);
    const categoriesUrl = `/api/square/catalog/categories?userId=${encodeURIComponent(user.id)}`;
    const autocompleteUrl = `/api/square/catalog/autocomplete-values?userId=${encodeURIComponent(user.id)}`;
    const itemsIndexUrl = `/api/square/catalog/items-index?userId=${encodeURIComponent(user.id)}`;

    fetch(categoriesUrl)
      .then((r) => r.json())
      .then((categoriesData) => {
        if (Array.isArray(categoriesData.categories)) {
          setSquareCategories(categoriesData.categories);
        }
      })
      .catch(() => {})
      .finally(() => setCategoriesLoading(false));

    fetch(autocompleteUrl)
      .then((r) => r.json())
      .then((valuesData) => {
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
      })
      .catch(() => {})
      .finally(() => setProductNameOptionsLoading(false));

    fetch(itemsIndexUrl)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.items)) {
          const map: Record<string, { sku: string; category: string; description: string; vendor: string; vendor_code: string }> = {};
          for (const row of data.items) {
            const name = (row as { name?: string }).name?.trim();
            if (name) {
              map[name] = {
                sku: (row as { sku?: string }).sku ?? '',
                category: (row as { category?: string }).category ?? '',
                description: (row as { description?: string }).description ?? '',
                vendor: (row as { vendor?: string }).vendor ?? '',
                vendor_code: (row as { vendor_code?: string }).vendor_code ?? '',
              };
            }
          }
          setCatalogItemsByName(map);
        }
      })
      .catch(() => {});
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
      const current = next[index];
      if (!current) return next;

      const newName = updates.product_name?.trim();
      if (newName !== undefined) {
        const lookup = catalogItemsByName[newName];
        if (lookup) {
          next[index] = {
            ...current,
            ...updates,
            sku: lookup.sku,
            category: lookup.category,
            description: lookup.description,
            vendor: lookup.vendor,
            vendor_code: lookup.vendor_code,
            addAsPoOnly: true,
          };
          return next;
        }
        if (current.addAsPoOnly) {
          next[index] = {
            ...current,
            ...updates,
            sku: '',
            category: '',
            description: '',
            vendor: '',
            vendor_id: undefined,
            vendor_code: '',
            addAsPoOnly: false,
          };
          return next;
        }
      }

      next[index] = { ...current, ...updates };
      return next;
    });
  }, [catalogItemsByName]);

  const newProducts = items.filter((i) => i.status === 'unmatched');
  const existingProducts = items.filter((i) => i.status === 'matched');

  const handleGetSuggestions = useCallback(async () => {
    if (!user?.id || newProducts.length === 0) return;
    setSuggestionsLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/suggest-prices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          items: newProducts.map((i) => ({ product_name: i.product_name, purchase_price: i.purchase_price })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get suggestions');
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      // Default all new items to 'formula' choice
      const choices: Record<number, 'ai' | 'formula'> = {};
      items.forEach((item, idx) => { if (item.status === 'unmatched') choices[idx] = 'formula'; });
      setPriceChoices(choices);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get AI suggestions');
    } finally {
      setSuggestionsLoading(false);
    }
  }, [user?.id, invoiceId, newProducts, items]);

  const handleUseDefaultMargin = useCallback(() => {
    // Clear suggestions, ensure all items use formula prices
    setSuggestions([]);
    setPriceChoices({});
  }, []);

  const getSuggestionForItem = useCallback((item: ConfirmItem): AiSuggestion | undefined => {
    return suggestions.find(
      (s) => s.name.toLowerCase().trim() === item.product_name.toLowerCase().trim()
    );
  }, [suggestions]);

  const applyPriceChoice = useCallback((itemIndex: number, choice: 'ai' | 'formula') => {
    const item = items[itemIndex];
    if (!item || item.status !== 'unmatched') return;
    const suggestion = getSuggestionForItem(item);
    const newPrice = choice === 'ai' && suggestion ? suggestion.suggested_price : formulaPricesRef.current[itemIndex] ?? null;
    setPriceChoices((prev) => ({ ...prev, [itemIndex]: choice }));
    updateItem(itemIndex, { retail_price: newPrice });
  }, [items, getSuggestionForItem, updateItem]);

  const applyAllPriceChoices = useCallback((choice: 'ai' | 'formula') => {
    items.forEach((item, idx) => {
      if (item.status !== 'unmatched') return;
      const suggestion = getSuggestionForItem(item);
      const newPrice = choice === 'ai' && suggestion ? suggestion.suggested_price : formulaPricesRef.current[idx] ?? null;
      setPriceChoices((prev) => ({ ...prev, [idx]: choice }));
      updateItem(idx, { retail_price: newPrice });
    });
  }, [items, getSuggestionForItem, updateItem]);

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
  const summaryVendor = poVendorName.trim() || '';
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
    if (!poVendorName.trim()) {
      setError('Please enter the vendor name for this purchase order.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/invoices/purchase-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          invoiceId,
          items: includedItems,
          poVendorName: poVendorName.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to create purchase order');

      if (data.csvBase64 && data.csvFilename) {
        const bin = atob(data.csvBase64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.csvFilename;
        a.click();
        URL.revokeObjectURL(url);
      }

      sessionStorage.removeItem(getConfirmItemsKey(invoiceId));
      router.push(`${tenantHref(`/invoices/${invoiceId}`)}?po_created=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    router.push(tenantHref(`/invoices/${invoiceId}/square`));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <InlineLoader label="Loading..." />
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">Confirm products & create purchase order</h1>
        <p className="text-slate-500 mt-1">Review and complete product details. New items are created in Square; a CSV is downloaded for all items.</p>
      </header>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* AI price suggestions banner */}
      {newProducts.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-amber-900">
              🤖 {newProducts.length} new item{newProducts.length > 1 ? 's' : ''} — not yet in your Square catalog
            </p>
            <div className="flex flex-wrap gap-2">
              {aiEnabled && (
                <button
                  type="button"
                  onClick={handleGetSuggestions}
                  disabled={suggestionsLoading}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition disabled:opacity-60"
                >
                  {suggestionsLoading && <InlineLoader size={16} />}
                  {suggestionsLoading ? 'Loading...' : 'Get AI price suggestions'}
                </button>
              )}
              <button
                type="button"
                onClick={handleUseDefaultMargin}
                className="inline-flex items-center px-3 py-1.5 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium transition"
              >
                Use default margin
              </button>
            </div>
          </div>
          {suggestions.length > 0 && (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => applyAllPriceChoices('ai')}
                className="text-xs px-2 py-1 rounded bg-amber-500 text-white hover:bg-amber-600 transition"
              >
                Apply all AI
              </button>
              <button
                type="button"
                onClick={() => applyAllPriceChoices('formula')}
                className="text-xs px-2 py-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 transition"
              >
                Apply all formula
              </button>
            </div>
          )}
        </div>
      )}

      <Card title="Items">
        <p className="text-sm text-slate-600 mb-4">Click a row to expand and edit. Include the items you want in the purchase order.</p>
        <div className="space-y-1">
          {items.map((item, i) => {
            const suggestion = item.status === 'unmatched' ? getSuggestionForItem(item) : undefined;
            const choice = priceChoices[i] ?? 'formula';
            const confidenceColor = suggestion?.confidence === 'high' ? 'bg-green-500' : suggestion?.confidence === 'medium' ? 'bg-amber-500' : 'bg-red-500';
            return (
            <div key={i} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
              <button
                type="button"
                onClick={() => setExpandedIndex((prev) => (prev === i ? null : i))}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition"
              >
                <input
                  type="checkbox"
                  checked={item.includedInPO !== false}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateItem(i, { includedInPO: e.target.checked });
                  }}
                  disabled={submitting}
                  className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="flex-1 font-medium text-slate-800 truncate">{item.product_name || 'Unnamed'}</span>
                {suggestion ? (
                  <span className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => applyPriceChoice(i, 'ai')}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition ${choice === 'ai' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                    >
                      AI: ${suggestion.suggested_price.toFixed(2)}
                      <span className={`w-2 h-2 rounded-full ${confidenceColor}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPriceChoice(i, 'formula')}
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium transition ${choice === 'formula' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                    >
                      Formula: ${(formulaPricesRef.current[i] ?? 0).toFixed(2)}
                    </button>
                  </span>
                ) : (
                  item.category?.trim() && (
                    <span className="text-xs text-slate-500 shrink-0 hidden sm:inline">
                      {item.category.trim()}
                    </span>
                  )
                )}
                <span className="text-slate-400 shrink-0">{expandedIndex === i ? '▼' : '▶'}</span>
              </button>
              {expandedIndex === i && (
                <div ref={(el) => { itemRefs.current[i] = el; }} className="border-t border-slate-100 p-4 bg-slate-50/50">
                  <ProductCard
                    item={item}
                    index={i}
                    missingFields={new Set(showValidation ? getMissingFields(item) : [])}
                    onChange={updateItem}
                    squareCategories={squareCategories}
                    categoryLoading={categoriesLoading}
                    productNameOptionsLoading={productNameOptionsLoading}
                    disabled={submitting}
                    squareItemFields={squareItemFields}
                    squareAutocomplete={squareAutocomplete}
                    userId={user?.id}
                  />
                </div>
              )}
            </div>
          );
          })}
        </div>
      </Card>

      <Card title="3️⃣ Purchase Order Summary">
        <div className="mb-4">
          <label htmlFor="po-vendor-name" className="block text-sm font-medium text-slate-700 mb-1">
            Vendor name for this purchase order
          </label>
          <input
            id="po-vendor-name"
            type="text"
            value={poVendorName}
            onChange={(e) => setPoVendorName(e.target.value)}
            placeholder="Type the vendor name"
            disabled={submitting}
            className="w-full max-w-md px-3 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>
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
        <p className="text-sm text-slate-500 mt-2">
          A CSV file matching the purchase order template will be downloaded. Items with an existing SKU are not created in Square.
        </p>
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
              <span className="inline-flex items-center gap-2">
                <InlineLoader size={24} />
                Creating...
              </span>
            ) : (
              'Create items and download purchase order'
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
