'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import InlineLoader from '@/components/ui/InlineLoader';
import ProductCard from '@/components/invoice-import/ProductCard';
import type { SquareFieldMetadata } from '@/components/invoice-import/SquareItemField';
import { getMissingFields } from '@/lib/invoice-import/confirm-types';
import type { ConfirmItem, RequiredField } from '@/lib/invoice-import/confirm-types';
import { useTenantHref } from '@/hooks/useTenantHref';
import { ArrowLeft, AlertTriangle, X, Layers } from 'lucide-react';

const EMPTY_ITEM: ConfirmItem = {
  product_name: '',
  quantity: 1,
  purchase_price: null,
  retail_price: null,
  category: '',
  sku: '',
  description: '',
  vendor: '',
  vendor_code: '',
  image: null,
  initial_stock: 0,
  status: 'unmatched',
  includedInPO: false,
};

type SimilarItem = { id: string; name: string; variationId?: string };

export default function NewInventoryItemPage() {
  const { user } = useAuth();
  const tenantHref = useTenantHref();
  const router = useRouter();

  const [item, setItem] = useState<ConfirmItem>({ ...EMPTY_ITEM });
  const [missingFields, setMissingFields] = useState<Set<RequiredField>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [squareCategories, setSquareCategories] = useState<string[]>([]);
  const [squareItemFields, setSquareItemFields] = useState<SquareFieldMetadata[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);

  // Variant suggestion state
  const [similarItems, setSimilarItems] = useState<SimilarItem[]>([]);
  const [showVariantBanner, setShowVariantBanner] = useState(false);
  const [variantDismissed, setVariantDismissed] = useState(false);
  const [isVariant, setIsVariant] = useState(false);
  const [selectedParent, setSelectedParent] = useState<SimilarItem | null>(null);
  const [variantName, setVariantName] = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSearchedName = useRef('');

  // Fetch categories and item fields on mount
  useEffect(() => {
    if (!user?.id) return;
    setCategoryLoading(true);
    fetch(`/api/square/catalog/categories?userId=${encodeURIComponent(user.id)}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.categories)) setSquareCategories(data.categories.map((c: { name: string }) => c.name));
      })
      .catch(() => {})
      .finally(() => setCategoryLoading(false));

    fetch(`/api/square/catalog/item-fields?userId=${encodeURIComponent(user.id)}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.fields)) setSquareItemFields(data.fields);
      })
      .catch(() => {});
  }, [user?.id]);

  // Debounced product name search for variant suggestions
  const searchSimilarItems = useCallback((name: string) => {
    if (!user?.id || name.length < 3) {
      setSimilarItems([]);
      setShowVariantBanner(false);
      return;
    }
    if (name === lastSearchedName.current) return;
    lastSearchedName.current = name;

    fetch(`/api/square/catalog?userId=${encodeURIComponent(user.id)}&search=${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((data) => {
        const items: SimilarItem[] = (data.items ?? [])
          .filter((it: { name?: string; id?: string }) =>
            it.name?.toLowerCase().includes(name.toLowerCase()) && it.id
          )
          .slice(0, 3)
          .map((it: { name: string; id: string; variationId?: string }) => ({
            id: it.id,
            name: it.name,
            variationId: it.variationId,
          }));

        setSimilarItems(items);
        if (items.length > 0 && !variantDismissed) {
          setShowVariantBanner(true);
        }
      })
      .catch(() => {});
  }, [user?.id, variantDismissed]);

  const handleItemChange = (_: number, updates: Partial<ConfirmItem>) => {
    setItem((prev) => {
      const next = { ...prev, ...updates };
      // Trigger name search when product_name changes
      if ('product_name' in updates && updates.product_name !== prev.product_name) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setVariantDismissed(false);
        setShowVariantBanner(false);
        setIsVariant(false);
        setSelectedParent(null);
        debounceRef.current = setTimeout(() => {
          searchSimilarItems(updates.product_name ?? '');
        }, 400);
      }
      return next;
    });
    // Clear missing field highlight on change
    if (missingFields.size > 0) {
      setMissingFields(new Set());
    }
  };

  const handleAcceptVariant = (parent: SimilarItem) => {
    setIsVariant(true);
    setSelectedParent(parent);
    setShowVariantBanner(false);
  };

  const handleDismissBanner = () => {
    setShowVariantBanner(false);
    setVariantDismissed(true);
  };

  const handleSubmit = async () => {
    if (!user?.id) return;

    const missing = getMissingFields(item);
    if (missing.length > 0) {
      setMissingFields(new Set(missing));
      setError('Please fill in all required fields before saving.');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      userId: user.id,
      items: [
        {
          product_name: item.product_name,
          sku: item.sku,
          category: item.category,
          description: item.description,
          retail_price: item.retail_price,
          purchase_price: item.purchase_price,
          initial_stock: item.initial_stock,
          image: item.image ?? undefined,
          vendor: item.vendor,
          vendor_code: item.vendor_code,
          vendor_id: item.vendor_id,
          ...(isVariant && selectedParent
            ? {
                parentCatalogItemId: selectedParent.id,
                variantName: variantName.trim() || item.product_name,
              }
            : {}),
        },
      ],
    };

    try {
      const res = await fetch('/api/square/catalog/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const msg = data.errors?.[0]?.error ?? data.error ?? 'Failed to create item';
        setError(msg);
        if (data.hint) setError(`${msg}. ${data.hint}`);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(tenantHref('/inventory'));
      }, 1500);
    } catch {
      setError('Failed to save item. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="flex items-center gap-3">
        <Link
          href={tenantHref('/inventory')}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">New Item</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Add a new product to your Square catalog</p>
        </div>
      </header>

      {/* Variant suggestion banner */}
      {showVariantBanner && similarItems.length > 0 && !isVariant && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-900">
                Similar product found — add as a variant?
              </p>
              <div className="mt-2 space-y-2">
                {similarItems.map((sim) => (
                  <div key={sim.id} className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-amber-800 font-medium truncate max-w-[200px]">{sim.name}</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleAcceptVariant(sim)}
                      className="text-amber-800 border-amber-300 bg-amber-100 hover:bg-amber-200 shrink-0"
                    >
                      <Layers className="w-3.5 h-3.5 mr-1" />
                      Add as variant
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={handleDismissBanner}
              className="p-1 rounded text-amber-500 hover:text-amber-700 hover:bg-amber-100 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Variant mode active */}
      {isVariant && selectedParent && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <Layers className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Adding as a variant of: <span className="font-semibold">{selectedParent.name}</span>
                </p>
                <p className="text-xs text-blue-700 mt-0.5">
                  A new variation will be added to the existing catalog item.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-blue-800 mb-1">
                  Variant name (e.g. color, size, weight)
                </label>
                <input
                  type="text"
                  value={variantName}
                  onChange={(e) => setVariantName(e.target.value)}
                  placeholder={`e.g. Blue, Large, 500g`}
                  className="px-3 py-2 rounded-lg border border-blue-200 text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none bg-white w-full max-w-xs"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setIsVariant(false); setSelectedParent(null); setVariantName(''); }}
              className="p-1 rounded text-blue-500 hover:text-blue-700 hover:bg-blue-100 shrink-0"
              title="Cancel variant"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <Card title="Item Details">
        {success ? (
          <div className="py-8 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-slate-800">Item created successfully!</p>
            <p className="text-sm text-slate-500">Redirecting to inventory…</p>
          </div>
        ) : (
          <div className="space-y-4">
            <ProductCard
              item={item}
              index={0}
              missingFields={missingFields}
              onChange={handleItemChange}
              squareCategories={squareCategories}
              categoryLoading={categoryLoading}
              squareItemFields={squareItemFields}
              userId={user?.id}
            />

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? (
                  <span className="inline-flex items-center gap-2">
                    <InlineLoader size={24} />
                    Saving…
                  </span>
                ) : (
                  isVariant ? 'Add Variant' : 'Create Item'
                )}
              </Button>
              <Link
                href={tenantHref('/inventory')}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Cancel
              </Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
