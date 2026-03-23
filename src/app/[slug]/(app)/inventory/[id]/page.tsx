'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantHref } from '@/hooks/useTenantHref';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import InlineLoader from '@/components/ui/InlineLoader';
import { AlertCircle, Pencil, ArrowRight, Link2, RefreshCw, ChevronDown, ChevronRight, Tag, Plus, X } from 'lucide-react';
import CategoryCombobox from '@/components/invoice-import/CategoryCombobox';
import { formulaPercentToMultiplier } from '@/lib/invoice/formula';
import { applyPsychologicalPricing, getPsychologicalPricingEnabled } from '@/lib/pricing/psychologicalPricing';
import { getConfirmItemsKey } from '@/lib/invoice-import/steps';
import type { ConfirmItem } from '@/lib/invoice-import/confirm-types';

type FormulaOption = { id: string; label: string; multiplier: number };

type CatalogVariation = { id: string; name: string; price?: number; sku?: string };
type CatalogItem = {
  id: string;
  name: string;
  sku?: string;
  category?: string;
  vendor?: string;
  vendor_code?: string;
  variations?: CatalogVariation[];
};

type ParsedItem = {
  skn?: string;
  product_name: string;
  quantity: number;
  price?: number;
  calculated_price?: number | null;
  formula?: string;
  matched_from_supplier_history?: boolean;
  invoice_item_id?: string;
  in_purchase_order?: boolean;
  catalogItemId?: string;
  catalogVariationId?: string;
  catalogName?: string;
  catalogCategory?: string;
  catalogVendor?: string;
  catalogVendorCode?: string;
  /** Vendor code extracted directly from invoice by Claude (short item code like "11577"). */
  invoiceVendorCode?: string | null;
  /** Square catalog variation price (pre-formula). */
  squareCatalogPrice?: number | null;
  salePrice?: number | null;
  status: 'matched' | 'unmatched';
  selected: boolean;
  /** Manual item creation fields */
  manualVendorName?: string;
  manualDescription?: string;
  manualImages?: string[];
};

type EditingCell = { index: number; field: 'skn' | 'name' | 'quantity' | 'price' | 'calculated_price' } | null;

const DEFAULT_FORMULAS: FormulaOption[] = [
  { id: 'default_100', label: '100%', multiplier: 2 * 1.1 },
  { id: 'default_35', label: '35%', multiplier: 1.35 * 1.1 },
];

function matchBySku(skn: string, catalogItems: CatalogItem[]): { item: CatalogItem; variation: CatalogVariation } | null {
  const sku = skn.trim().toLowerCase();
  if (!sku) return null;
  for (const cat of catalogItems) {
    // Check variation-level SKU first (primary location in Square)
    for (const v of cat.variations ?? []) {
      if (v.sku?.trim().toLowerCase() === sku) {
        return { item: cat, variation: v };
      }
    }
    // Fallback: check item-level SKU
    if (cat.sku?.trim().toLowerCase() === sku) {
      const firstVar = cat.variations?.[0];
      if (firstVar) return { item: cat, variation: firstVar };
    }
  }
  return null;
}

function looksLikeGtin(s: string): boolean {
  const digits = s.replace(/\D/g, '');
  return [8, 12, 13, 14].includes(digits.length) && /^\d+$/.test(digits);
}

function toConfirmItem(item: ParsedItem): ConfirmItem {
  const skn = (item.skn ?? '').trim();
  return {
    product_name: item.product_name,
    quantity: item.quantity,
    purchase_price: item.price != null ? Number(item.price) : null,
    retail_price: item.salePrice != null && !Number.isNaN(Number(item.salePrice)) ? Number(item.salePrice) : null,
    category: item.catalogCategory ?? '',
    sku: skn,
    description: item.manualDescription ?? '',
    vendor: item.manualVendorName ?? item.catalogVendor ?? '',
    vendor_code: item.invoiceVendorCode ?? item.catalogVendorCode ?? '',
    gtin: looksLikeGtin(skn) ? skn.replace(/\D/g, '') : undefined,
    image: item.manualImages?.[0] ?? null,
    images: item.manualImages?.slice(1) ?? [],
    initial_stock: item.quantity,
    status: item.status,
    catalogItemId: item.catalogItemId,
    catalogVariationId: item.catalogVariationId,
    catalogName: item.catalogName,
    invoice_item_id: item.invoice_item_id,
  };
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantHref = useTenantHref();
  const { user } = useAuth();
  const [invoice, setInvoice] = useState<{
    id: string;
    file_name: string;
    status: string;
  } | null>(null);
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<EditingCell>(null);
  const [editValue, setEditValue] = useState('');
  const [editCursorPosition, setEditCursorPosition] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formulaOptions, setFormulaOptions] = useState<FormulaOption[]>(DEFAULT_FORMULAS);
  const [squareConnected, setSquareConnected] = useState(false);
  const [reenabling, setReenabling] = useState(false);

  // Manual item creation modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualSku, setManualSku] = useState('');
  const [manualVendorCode, setManualVendorCode] = useState('');
  const [manualVendorName, setManualVendorName] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualCategory, setManualCategory] = useState('');
  const [manualImages, setManualImages] = useState<string[]>([]);
  const [manualFormError, setManualFormError] = useState('');
  const editInputRef = useRef<HTMLInputElement | null>(null);

  const id = params.id as string;

  const applyCalcFormulaToRow = (index: number, formulaId: string) => {
    const formula = formulaOptions.find((f) => f.id === formulaId);
    if (!formula) return;
    setItems((prev) => {
      const next = [...prev];
      const item = next[index];
      if (!item) return prev;
      const base = item.price != null ? Number(item.price) : null;
      let calculated = base != null && base > 0 ? Math.round(base * formula.multiplier * 100) / 100 : null;
      if (calculated != null && calculated > 0 && getPsychologicalPricingEnabled()) {
        calculated = applyPsychologicalPricing(calculated);
      }
      next[index] = { ...item, calculated_price: calculated, salePrice: calculated, formula: formulaId };
      return next;
    });
  };

  const openAddModal = () => {
    setManualSku('');
    setManualVendorCode('');
    setManualVendorName('');
    setManualDescription('');
    setManualCategory('');
    setManualImages([]);
    setManualFormError('');
    setShowAddModal(true);
  };

  const handleManualImageFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result;
        if (typeof result === 'string') setManualImages((prev) => [...prev, result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddManualItem = () => {
    if (!manualSku.trim()) { setManualFormError('SKU is required.'); return; }
    if (!manualCategory.trim()) { setManualFormError('Category is required.'); return; }
    const defaultFormulaId = formulaOptions[0]?.id ?? 'custom';
    const newItem: ParsedItem = {
      skn: manualSku.trim(),
      product_name: manualSku.trim(),
      quantity: 1,
      price: undefined,
      calculated_price: null,
      formula: defaultFormulaId,
      status: 'unmatched',
      selected: true,
      catalogCategory: manualCategory.trim(),
      invoiceVendorCode: manualVendorCode.trim() || null,
      manualVendorName: manualVendorName.trim(),
      manualDescription: manualDescription.trim(),
      manualImages,
    };
    setItems((prev) => [newItem, ...prev]);
    setShowAddModal(false);
  };

  const applyMarginPctToRow = (index: number, pct: number) => {
    setItems((prev) => {
      const next = [...prev];
      const item = next[index];
      if (!item) return prev;
      const base = item.price != null ? Number(item.price) : null;
      const multiplier = (1 + pct / 100) * 1.1;
      let calculated = base != null && base > 0 ? Math.round(base * multiplier * 100) / 100 : null;
      if (calculated != null && calculated > 0 && getPsychologicalPricingEnabled()) {
        calculated = applyPsychologicalPricing(calculated);
      }
      next[index] = { ...item, calculated_price: calculated, salePrice: calculated, formula: 'custom' };
      return next;
    });
  };

  const getItemMarginPct = (item: ParsedItem): number => {
    const opt = formulaOptions.find((f) => f.id === item.formula);
    if (opt) return Math.round((opt.multiplier / 1.1 - 1) * 100);
    if (item.price != null && item.price > 0 && item.salePrice != null) {
      return Math.round((item.salePrice / (item.price * 1.1) - 1) * 100);
    }
    return formulaOptions[0] ? Math.round((formulaOptions[0].multiplier / 1.1 - 1) * 100) : 100;
  };

  const applySquarePriceToRow = (index: number) => {
    setItems((prev) => {
      const next = [...prev];
      const item = next[index];
      if (!item) return prev;
      const squarePrice = item.squareCatalogPrice ?? null;
      if (squarePrice == null) return prev;
      next[index] = {
        ...item,
        calculated_price: squarePrice,
        salePrice: squarePrice,
        formula: 'custom',
      };
      return next;
    });
  };

  const getCaretOffsetFromClick = (e: React.MouseEvent): number => {
    const doc = document as Document & { caretRangeFromPoint?(x: number, y: number): Range; caretPositionFromPoint?(x: number, y: number): { offset: number } };
    const range = doc.caretRangeFromPoint?.(e.clientX, e.clientY);
    if (range) return range.startOffset;
    const pos = doc.caretPositionFromPoint?.(e.clientX, e.clientY);
    if (pos) return pos.offset;
    return 0;
  };

  const startEdit = (index: number, field: 'skn' | 'name' | 'quantity' | 'price' | 'calculated_price', cursorPosition?: number | null) => {
    const item = items[index];
    if (!item) return;
    setEditing({ index, field });
    setEditCursorPosition(cursorPosition ?? null);
    if (field === 'skn') setEditValue(item.skn ?? '');
    else if (field === 'name') setEditValue(item.product_name);
    else if (field === 'quantity') setEditValue(String(item.quantity));
    else if (field === 'price') setEditValue(item.price != null ? String(item.price) : '');
    else setEditValue(item.calculated_price != null ? String(item.calculated_price) : '');
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
    if (field === 'price') {
      const num = parseFloat(editValue);
      const value = Number.isNaN(num) || num < 0 ? null : Math.round(num * 100) / 100;
      if (value == null) {
        cancelEdit();
        return;
      }

      setItems((prev) => {
        const next = [...prev];
        const item = next[index];
        if (!item) return prev;

        const updated = { ...item, price: value };
        const formulaId = updated.formula ?? formulaOptions[0]?.id ?? 'custom';

        // If the row is using a non-custom formula, changing base price should
        // re-calculate sale price immediately.
        if (formulaId && formulaId !== 'custom') {
          const formula = formulaOptions.find((f) => f.id === formulaId);
          if (formula) {
            let calculated = value > 0 ? Math.round(value * formula.multiplier * 100) / 100 : null;
            if (calculated != null && calculated > 0 && getPsychologicalPricingEnabled()) {
              calculated = applyPsychologicalPricing(calculated);
            }
            updated.calculated_price = calculated;
            updated.salePrice = calculated;
          }
        }

        next[index] = updated;
        return next;
      });

      setEditing(null);
      setEditValue('');
      return;
    }

    if (field === 'calculated_price') {
      const num = parseFloat(editValue);
      const value = Number.isNaN(num) || num < 0 ? null : Math.round(num * 100) / 100;
      setItems((prev) => {
        const next = [...prev];
        const item = next[index];
        if (!item) return prev;
        // For matched rows we display `salePrice`, so update it too.
        next[index] = { ...item, calculated_price: value, salePrice: value, formula: 'custom' };
        return next;
      });
      setEditing(null);
      setEditValue('');
      return;
    }
    setItems((prev) => {
      const next = [...prev];
      const item = next[index];
      if (!item) return prev;
      if (field === 'skn') {
        const newSkn = editValue.trim();
        const match = matchBySku(newSkn, catalogItems);
        if (match) {
          // Keep sale price consistent with formula-calculated value.
          const squareCatalogPrice = match.variation.price ?? null;
          const salePrice = item.calculated_price ?? match.variation.price ?? null;
          next[index] = {
            ...item,
            skn: newSkn,
            catalogItemId: match.item.id,
            catalogVariationId: match.variation.id,
            catalogName: match.item.name,
            catalogCategory: match.item.category,
            catalogVendor: match.item.vendor,
            catalogVendorCode: match.item.vendor_code,
            salePrice,
            squareCatalogPrice,
            status: 'matched',
          };
        } else {
          next[index] = {
            ...item,
            skn: newSkn,
            catalogItemId: undefined,
            catalogVariationId: undefined,
            catalogName: undefined,
            catalogCategory: undefined,
            catalogVendor: undefined,
            catalogVendorCode: undefined,
            salePrice: item.calculated_price ?? null,
            squareCatalogPrice: null,
            status: 'unmatched',
          };
        }
      } else if (field === 'name') {
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
    setEditCursorPosition(null);
  };

  useEffect(() => {
    if (editing == null || editCursorPosition == null || !editInputRef.current) return;
    const input = editInputRef.current;
    input.focus();
    const type = input.type;
    if (type === 'text' || type === 'search' || type === 'url' || type === 'tel' || type === 'password') {
      const pos = Math.min(editCursorPosition, editValue.length);
      input.setSelectionRange(pos, pos);
    }
    setEditCursorPosition(null);
  }, [editing, editCursorPosition, editValue.length]);

  const applyMatching = useCallback((rawItems: Array<{
    id?: string;
    skn?: string;
    product_name: string;
    quantity: number;
    price?: number;
    calculated_price?: number | null;
    matched_from_supplier_history?: boolean;
    in_purchase_order?: boolean;
    vendorCode?: string | null;
  }>, catalog: CatalogItem[], options: FormulaOption[]) => {
    const defaultMultiplier = options[0]?.multiplier ?? DEFAULT_FORMULAS[0].multiplier;
    const defaultFormulaId = options[0]?.id ?? 'custom';
    const usePsychological = getPsychologicalPricingEnabled();

    return rawItems.map((i): ParsedItem => {
      const price = i.price != null ? Number(i.price) : null;
      const hasCalc = i.calculated_price != null && !Number.isNaN(Number(i.calculated_price));
      let calculated_price = hasCalc ? Number(i.calculated_price) : (price != null && price > 0 ? Math.round(price * defaultMultiplier * 100) / 100 : null);
      if (calculated_price != null && calculated_price > 0 && usePsychological) {
        calculated_price = applyPsychologicalPricing(calculated_price);
      }
      let formula: string = defaultFormulaId;
      if (hasCalc && price != null && price > 0 && calculated_price != null) {
        const matched = options.find((opt) => Math.round(price * opt.multiplier * 100) / 100 === calculated_price);
        formula = matched ? matched.id : 'custom';
      }

      const match = matchBySku(i.skn ?? '', catalog);
      const inPO = Boolean(i.in_purchase_order);
      // Show the formula-derived sale price first; only fall back to
      // Square catalog variation price if we can't calculate.
      const squareCatalogPrice = match?.variation.price ?? null;
      const salePrice = calculated_price ?? squareCatalogPrice ?? null;

      return {
        skn: i.skn ?? '',
        product_name: i.product_name,
        quantity: i.quantity,
        price: i.price,
        calculated_price,
        formula,
        matched_from_supplier_history: i.matched_from_supplier_history ?? false,
        invoice_item_id: i.id,
        in_purchase_order: inPO,
        catalogItemId: match?.item.id,
        catalogVariationId: match?.variation.id,
        catalogName: match?.item.name,
        catalogCategory: match?.item.category,
        catalogVendor: match?.item.vendor,
        catalogVendorCode: match?.item.vendor_code,
        invoiceVendorCode: i.vendorCode ?? null,
        salePrice,
        squareCatalogPrice,
        status: match ? 'matched' : 'unmatched',
        selected: !inPO,
      };
    });
  }, []);

  useEffect(() => {
    if (!id || !user?.id) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [invRes, formulasRes, catRes] = await Promise.all([
          fetch(`/api/invoices/${id}?userId=${user.id}`),
          fetch(`/api/settings/invoice-formulas?userId=${user.id}`),
          fetch(`/api/square/catalog?userId=${user.id}`),
        ]);
        const data = await invRes.json();
        const formulasData = await formulasRes.json();
        const catData = await catRes.json();

        const catalog: CatalogItem[] = catData.items || [];
        setCatalogItems(catalog);
        setSquareConnected(catRes.ok && !catData.error);

        const options: FormulaOption[] =
          formulasRes.ok && Array.isArray(formulasData.formulas) && formulasData.formulas.length > 0
            ? formulasData.formulas.map((f: { id: string; label: string; formula_percent: string }) => ({
                id: f.id,
                label: f.label || 'Formula',
                multiplier: formulaPercentToMultiplier(f.formula_percent),
              }))
            : DEFAULT_FORMULAS;
        setFormulaOptions(options);

        if (!invRes.ok) throw new Error(data.error || 'Failed to load');

        setInvoice(data.invoice);

        const initialItems = applyMatching(data.items || [], catalog, options);
        setItems(initialItems);

        if (data.invoice?.status === 'uploaded' && (data.items?.length ?? 0) === 0) {
          setParsing(true);
          setError('');
          try {
            const parseRes = await fetch(`/api/invoices/parse`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ invoiceId: id, userId: user.id }),
            });
            const text = await parseRes.text();
            let parseData: { items?: unknown[]; error?: string };
            try {
              parseData = text ? JSON.parse(text) : {};
            } catch {
              parseData = { error: parseRes.ok ? 'Invalid response' : 'Parsing failed' };
            }
            if (parseRes.ok && parseData.items?.length) {
              const parsedRaw = (parseData.items as Array<{ skn?: string; code?: string; product_name?: string; name?: string; quantity: number; price?: number; matched_from_supplier_history?: boolean; vendorCode?: string | null }>).map((i) => ({
                skn: i.skn ?? i.code ?? '',
                product_name: i.product_name ?? i.name ?? '',
                quantity: i.quantity,
                price: i.price,
                calculated_price: null as number | null,
                matched_from_supplier_history: i.matched_from_supplier_history ?? false,
                vendorCode: i.vendorCode ?? null,
              }));
              const parsedItems = applyMatching(parsedRaw, catalog, options);
              setItems(parsedItems);
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
  }, [id, user?.id, applyMatching]);

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
      const res = await fetch(`/api/invoices/${id}/items/reenable?userId=${encodeURIComponent(user.id)}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to re-enable');
      const invRes = await fetch(`/api/invoices/${id}?userId=${user.id}`);
      const invData = await invRes.json();
      const updatedItems = applyMatching(invData.items || [], catalogItems, formulaOptions);
      setItems(updatedItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to re-enable items');
    } finally {
      setReenabling(false);
    }
  };

  const handleConfirm = async () => {
    if (!user?.id || items.length === 0 || !id) return;
    const selectedItems = items.filter((i) => i.selected);
    if (selectedItems.length === 0) {
      setError('Select at least one item to continue.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/invoices/${id}?userId=${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({
            skn: item.skn ?? '',
            product_name: item.product_name,
            quantity: item.quantity,
            price: item.price,
            calculated_price: item.calculated_price ?? null,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to save items');
        return;
      }
      const payload: ConfirmItem[] = selectedItems.map(toConfirmItem);
      sessionStorage.setItem(getConfirmItemsKey(id), JSON.stringify(payload));

      router.push(tenantHref(`/inventory/${id}/confirm`));
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
      const text = await parseRes.text();
      let parseData: { items?: unknown[]; error?: string };
      try {
        parseData = text ? JSON.parse(text) : {};
      } catch {
        parseData = { error: parseRes.ok ? 'Invalid response' : 'Parsing failed' };
      }
      if (parseRes.ok && parseData.items?.length) {
        const parsedRaw = (parseData.items as Array<{ skn?: string; code?: string; product_name?: string; name?: string; quantity: number; price?: number; matched_from_supplier_history?: boolean; vendorCode?: string | null }>).map((i) => ({
          skn: i.skn ?? i.code ?? '',
          product_name: i.product_name ?? i.name ?? '',
          quantity: i.quantity,
          price: i.price,
          calculated_price: null as number | null,
          matched_from_supplier_history: i.matched_from_supplier_history ?? false,
          vendorCode: i.vendorCode ?? null,
        }));
        const parsedItems = applyMatching(parsedRaw, catalogItems, formulaOptions);
        setItems(parsedItems);
        setInvoice((prev) => prev ? { ...prev, status: 'parsed' } : null);
      } else if (!parseRes.ok) {
        setError(parseData.error || 'Parsing failed');
      }
    } finally {
      setParsing(false);
    }
  };

  const matchedCount = items.filter((i) => i.status === 'matched').length;
  const selectedCount = items.filter((i) => i.selected).length;
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const toggleGroup = (key: string) => setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  // Group items by status type
  const groupedItems = {
    needsUpdate: items.map((item, i) => ({ item, i })).filter(({ item }) =>
      item.status === 'matched' &&
      item.squareCatalogPrice != null &&
      item.salePrice != null &&
      Math.abs(Number(item.salePrice) - Number(item.squareCatalogPrice)) > 0.01
    ),
    matched: items.map((item, i) => ({ item, i })).filter(({ item }) =>
      item.status === 'matched' &&
      !(item.squareCatalogPrice != null && item.salePrice != null && Math.abs(Number(item.salePrice) - Number(item.squareCatalogPrice)) > 0.01)
    ),
    newItems: items.map((item, i) => ({ item, i })).filter(({ item }) => item.status === 'unmatched'),
  };

  const totalCostSummary = items.reduce((sum, i) => sum + (i.price != null && i.selected ? Number(i.price) * i.quantity : 0), 0);
  const totalRetailSummary = items.reduce((sum, i) => {
    const retail = i.salePrice ?? i.calculated_price;
    return sum + (retail != null && i.selected ? Number(retail) * i.quantity : 0);
  }, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <InlineLoader label="Loading invoice..." />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-slate-600">{error || 'Invoice not found'}</p>
        <Button className="mt-4" onClick={() => router.push(tenantHref('/inventory'))}>
          Back to Invoices
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Invoice: {invoice.file_name}</h1>
          <p className="text-slate-500 mt-1">Review items, check Square matches, and continue to create purchase order</p>
        </div>
        <Button variant="secondary" onClick={handleParseAgain} disabled={parsing}>
          {parsing ? (
            <span className="inline-flex items-center gap-2">
              <InlineLoader size={28} />
              Parsing…
            </span>
          ) : (
            'Parse again'
          )}
        </Button>
      </header>

      {!squareConnected && (
        <Card>
          <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-amber-800">Connect Square</p>
              <p className="text-sm text-amber-700">
                Connect your Square account to match products by SKU.
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

      {/* Sticky summary bar */}
      {items.length > 0 && !parsing && (
        <div className="sticky top-0 z-10 bg-white border border-slate-200 rounded-lg shadow-sm px-4 py-3 flex flex-wrap items-center gap-4 text-sm">
          <span className="font-medium text-slate-700">{selectedCount} / {items.length} selected</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-600">Total cost: <span className="font-semibold text-slate-800">${totalCostSummary.toFixed(2)}</span></span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-600">Est. retail: <span className="font-semibold text-green-700">${totalRetailSummary.toFixed(2)}</span></span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-600">{matchedCount} matched · {groupedItems.newItems.length} new · {groupedItems.needsUpdate.length} need update</span>
        </div>
      )}

      {parsing ? (
        <Card>
          <div className="flex items-center gap-3 py-4">
            <InlineLoader label="Parsing invoice..." />
          </div>
        </Card>
      ) : (
        <Card title="Parsed Items">
          {error && (
            <p className="text-red-500 text-sm mb-4">{error}</p>
          )}

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Button variant="secondary" size="sm" onClick={openAddModal}>
              <Plus className="w-4 h-4 mr-1" />
              Add item manually
            </Button>
            {items.length > 0 && (
              <>
              <Button variant="secondary" size="sm" onClick={selectAll}>Select all</Button>
              <Button variant="secondary" size="sm" onClick={deselectAll}>Deselect all</Button>
              {hasItemsInPO && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleReenable}
                  disabled={reenabling}
                  className="text-amber-700 border-amber-300 hover:bg-amber-50"
                >
                  {reenabling ? <InlineLoader size={24} /> : null}
                  Re-enable items for purchase order
                </Button>
              )}
              </>
            )}
          </div>

          {items.length === 0 ? (
            <p className="text-slate-500">No items could be extracted. Use <strong>Parse again</strong> above to re-run extraction on the invoice.</p>
          ) : (
            <div className="space-y-4">
              {(
                [
                  { key: 'needsUpdate', label: 'Needs update', entries: groupedItems.needsUpdate, badgeClass: 'bg-amber-100 text-amber-800', headerClass: 'bg-amber-50 border-amber-200' },
                  { key: 'newItems', label: 'New items', entries: groupedItems.newItems, badgeClass: 'bg-blue-100 text-blue-700', headerClass: 'bg-blue-50 border-blue-200' },
                  { key: 'matched', label: 'Matched', entries: groupedItems.matched, badgeClass: 'bg-green-100 text-green-700', headerClass: 'bg-green-50 border-green-200' },
                ] as const
              ).filter(({ entries }) => entries.length > 0).map(({ key, label, entries, badgeClass, headerClass }) => (
                <div key={key} className={`rounded-lg border ${headerClass}`}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(key)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left ${headerClass} rounded-t-lg`}
                  >
                    {collapsedGroups[key] ? <ChevronRight className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    <span className="font-semibold text-slate-700">{label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>{entries.length}</span>
                  </button>
                  {!collapsedGroups[key] && (
                    <div className="divide-y divide-slate-100">
                      {entries.map(({ item, i }) => {
                        const inPO = item.in_purchase_order;
                        const salePrice = item.status === 'matched' && item.salePrice != null ? Number(item.salePrice) : item.calculated_price != null ? Number(item.calculated_price) : null;
                        const marginPct = item.price != null && Number(item.price) > 0 && salePrice != null
                          ? Math.round(((salePrice - Number(item.price)) / Number(item.price)) * 100)
                          : null;
                        const vendorCode = item.invoiceVendorCode ?? item.catalogVendorCode;
                        const needsSquareUpdate = item.status === 'matched' && item.squareCatalogPrice != null && item.salePrice != null && Math.abs(Number(item.salePrice) - Number(item.squareCatalogPrice)) > 0.01;
                        return (
                          <div key={i} className={`px-4 py-3 bg-white ${inPO ? 'opacity-60' : ''} last:rounded-b-lg`}>
                            <div className="flex items-start gap-3 flex-wrap sm:flex-nowrap">
                              {/* Checkbox */}
                              <div className="pt-0.5 shrink-0">
                                <input
                                  type="checkbox"
                                  checked={item.selected}
                                  onChange={() => toggleSelected(i)}
                                  disabled={inPO}
                                  className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                                />
                              </div>

                              {/* Left: name + SKU + vendor_code */}
                              <div className="flex-1 min-w-0">
                                {editing?.index === i && editing?.field === 'name' ? (
                                  <input
                                    ref={editInputRef}
                                    type="text"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={saveEdit}
                                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                                    className="w-full px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-primary-500 outline-none text-sm font-semibold"
                                    autoFocus
                                  />
                                ) : (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span
                                      className={`font-semibold text-slate-800 cursor-text ${inPO ? 'text-slate-500' : ''}`}
                                      onClick={(e) => startEdit(i, 'name', getCaretOffsetFromClick(e))}
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(i, 'name'); } }}
                                    >
                                      {item.product_name}
                                    </span>
                                    <button type="button" onClick={() => startEdit(i, 'name')} className="p-0.5 rounded text-slate-300 hover:text-primary-600" title="Edit name"><Pencil className="w-3 h-3" /></button>
                                    {inPO && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">In PO</span>}
                                    {item.matched_from_supplier_history && <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">History</span>}
                                  </div>
                                )}
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  {editing?.index === i && editing?.field === 'skn' ? (
                                    <input
                                      ref={editInputRef}
                                      type="text"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onBlur={saveEdit}
                                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                                      className="w-28 px-2 py-0.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-primary-500 outline-none"
                                      autoFocus
                                    />
                                  ) : (
                                    <span
                                      className="text-xs text-slate-400 cursor-text flex items-center gap-1"
                                      onClick={(e) => startEdit(i, 'skn', getCaretOffsetFromClick(e))}
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(i, 'skn'); } }}
                                    >
                                      SKU: {item.skn || '—'}
                                      <button type="button" onClick={(e) => { e.stopPropagation(); startEdit(i, 'skn'); }} className="text-slate-300 hover:text-primary-600" title="Edit SKU"><Pencil className="w-3 h-3" /></button>
                                    </span>
                                  )}
                                  {vendorCode && (
                                    <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                                      <Tag className="w-2.5 h-2.5" />
                                      {vendorCode}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Center: qty × price + formula */}
                              <div className="flex flex-col items-end sm:items-center gap-1 shrink-0 text-sm">
                                <div className="flex items-center gap-1 text-slate-600">
                                  {editing?.index === i && editing?.field === 'quantity' ? (
                                    <input
                                      ref={editInputRef}
                                      type="number"
                                      min={1}
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onBlur={saveEdit}
                                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                                      className="w-16 px-1 py-0.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-primary-500 outline-none"
                                      autoFocus
                                    />
                                  ) : (
                                    <span
                                      className="cursor-text"
                                      onClick={() => startEdit(i, 'quantity')}
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(i, 'quantity'); } }}
                                    >
                                      {item.quantity}
                                    </span>
                                  )}
                                  <span className="text-slate-400">×</span>
                                  {editing?.index === i && editing?.field === 'price' ? (
                                    <input
                                      ref={editInputRef}
                                      type="number"
                                      min={0}
                                      step={0.01}
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onBlur={saveEdit}
                                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                                      className="w-20 px-1 py-0.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-primary-500 outline-none"
                                      autoFocus
                                    />
                                  ) : (
                                    <span
                                      className="cursor-text font-medium"
                                      onClick={() => startEdit(i, 'price')}
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(i, 'price'); } }}
                                    >
                                      {item.price != null ? `$${Number(item.price).toFixed(2)}` : '—'}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={0}
                                    max={9999}
                                    step={1}
                                    value={getItemMarginPct(item)}
                                    onChange={(e) => applyMarginPctToRow(i, Number(e.target.value))}
                                    className="w-14 px-1.5 py-0.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-primary-500 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                    title="Markup %"
                                  />
                                  <span className="text-xs text-slate-500">%</span>
                                </div>
                              </div>

                              {/* Right: margin + retail price + status + update button */}
                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <div className="flex items-center gap-2">
                                  {marginPct != null && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${marginPct >= 100 ? 'bg-green-100 text-green-700' : marginPct >= 35 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                      {marginPct}%
                                    </span>
                                  )}
                                  {editing?.index === i && editing?.field === 'calculated_price' ? (
                                    <input
                                      ref={editInputRef}
                                      type="number"
                                      min={0}
                                      step={0.01}
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onBlur={saveEdit}
                                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                                      className="w-20 px-1 py-0.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-primary-500 outline-none"
                                      autoFocus
                                    />
                                  ) : (
                                    <span
                                      className="font-semibold text-slate-800 cursor-text text-sm"
                                      onClick={() => startEdit(i, 'calculated_price')}
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(i, 'calculated_price'); } }}
                                    >
                                      {salePrice != null ? `$${salePrice.toFixed(2)}` : '—'}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {item.status === 'matched' ? (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Matched</span>
                                  ) : (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">New</span>
                                  )}
                                  {needsSquareUpdate && (
                                    <button
                                      type="button"
                                      onClick={() => applySquarePriceToRow(i)}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 font-medium"
                                      title={`Square price is $${Number(item.squareCatalogPrice).toFixed(2)}`}
                                    >
                                      <RefreshCw className="w-3 h-3" />
                                      Update from Square
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex gap-4">
            <Button variant="secondary" onClick={() => router.push(tenantHref('/inventory'))}>
              Back to Invoices
            </Button>
            <Button onClick={handleConfirm} disabled={selectedCount === 0 || saving}>
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <InlineLoader size={28} />
                  Saving...
                </span>
              ) : (
                <><ArrowRight className="w-4 h-4 mr-2" /> Continue to confirmation ({selectedCount})</>
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* Manual item creation modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-800">Add item manually</h2>
              <button type="button" onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {manualFormError && <p className="text-sm text-red-600">{manualFormError}</p>}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">SKU <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={manualSku}
                  onChange={(e) => setManualSku(e.target.value)}
                  placeholder="e.g. PET-001"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category <span className="text-red-500">*</span></label>
                <CategoryCombobox
                  value={manualCategory}
                  onChange={setManualCategory}
                  categories={Array.from(new Set(catalogItems.map((c) => c.category).filter(Boolean) as string[])).sort()}
                  placeholder="Type or pick a category"
                  missing={false}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vendor code</label>
                <input
                  type="text"
                  value={manualVendorCode}
                  onChange={(e) => setManualVendorCode(e.target.value)}
                  placeholder="e.g. 11577"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vendor name</label>
                <input
                  type="text"
                  value={manualVendorName}
                  onChange={(e) => setManualVendorName(e.target.value)}
                  placeholder="e.g. Petstock Wholesale"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  placeholder="Short product description"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Images</label>
                {manualImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {manualImages.map((src, idx) => (
                      <div key={idx} className="relative inline-block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="h-16 w-16 object-cover rounded border border-slate-200" />
                        <button
                          type="button"
                          onClick={() => setManualImages((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-1 -right-1 p-0.5 rounded-full bg-red-500 text-white hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-primary-600 hover:text-primary-700 font-medium">
                  <Plus className="w-4 h-4" />
                  Select images
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif"
                    multiple
                    className="hidden"
                    onChange={handleManualImageFiles}
                  />
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button onClick={handleAddManualItem}>
                <Plus className="w-4 h-4 mr-2" />
                Add item
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
