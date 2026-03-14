'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Loader2, Check, AlertCircle, Pencil, Sparkles } from 'lucide-react';
import { formulaPercentToMultiplier } from '@/lib/invoice/formula';
import { applyPsychologicalPricing, getPsychologicalPricingEnabled } from '@/lib/pricing/psychologicalPricing';

type FormulaOption = { id: string; label: string; multiplier: number };

type ParsedItem = {
  skn?: string;
  product_name: string;
  quantity: number;
  price?: number;
  calculated_price?: number | null;
  formula?: string;
  matched_from_supplier_history?: boolean;
};

type EditingCell = { index: number; field: 'skn' | 'name' | 'quantity' | 'calculated_price' } | null;

const DEFAULT_FORMULAS: FormulaOption[] = [
  { id: 'default_100', label: '100%', multiplier: 2 * 1.1 },
  { id: 'default_35', label: '35%', multiplier: 1.35 * 1.1 },
];

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
  const [editCursorPosition, setEditCursorPosition] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formulaOptions, setFormulaOptions] = useState<FormulaOption[]>(DEFAULT_FORMULAS);
  const [supplierAccuracy, setSupplierAccuracy] = useState<number | null>(null);
  const [learningSavedMessage, setLearningSavedMessage] = useState(false);
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
      next[index] = { ...item, calculated_price: calculated, formula: formulaId };
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

  const startEdit = (index: number, field: 'skn' | 'name' | 'quantity' | 'calculated_price', cursorPosition?: number | null) => {
    const item = items[index];
    if (!item) return;
    setEditing({ index, field });
    setEditCursorPosition(cursorPosition ?? null);
    if (field === 'skn') setEditValue(item.skn ?? '');
    else if (field === 'name') setEditValue(item.product_name);
    else if (field === 'quantity') setEditValue(String(item.quantity));
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
    if (field === 'calculated_price') {
      const num = parseFloat(editValue);
      const value = Number.isNaN(num) || num < 0 ? null : Math.round(num * 100) / 100;
      setItems((prev) => {
        const next = [...prev];
        const item = next[index];
        if (!item) return prev;
        next[index] = { ...item, calculated_price: value, formula: 'custom' };
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
        next[index] = { ...item, skn: editValue.trim() };
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

  useEffect(() => {
    if (!id || !user?.id) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [invRes, formulasRes] = await Promise.all([
          fetch(`/api/invoices/${id}?userId=${user.id}`),
          fetch(`/api/settings/invoice-formulas?userId=${user.id}`),
        ]);
        const data = await invRes.json();
        const formulasData = await formulasRes.json();

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
        setSupplierAccuracy(data.supplier_accuracy ?? null);
        const defaultMultiplier = options[0]?.multiplier ?? DEFAULT_FORMULAS[0].multiplier;
        const defaultFormulaId = options[0]?.id ?? 'custom';
        const usePsychological = getPsychologicalPricingEnabled();
        const initialItems = (data.items || []).map((i: { skn?: string; product_name: string; quantity: number; price?: number; calculated_price?: number | null; matched_from_supplier_history?: boolean }) => {
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
          return {
            skn: i.skn ?? '',
            product_name: i.product_name,
            quantity: i.quantity,
            price: i.price,
            calculated_price,
            formula,
            matched_from_supplier_history: i.matched_from_supplier_history ?? false,
          };
        });
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
              const defaultMultiplier = options[0]?.multiplier ?? DEFAULT_FORMULAS[0].multiplier;
              const defaultFormulaId = options[0]?.id ?? 'custom';
              const usePsychological = getPsychologicalPricingEnabled();
              const parsedItems = (parseData.items as Array<{ skn?: string; product_name?: string; name?: string; quantity: number; price?: number }>).map((i) => {
                const base = i.price != null ? Number(i.price) : null;
                let calculated_price = base != null && base > 0 ? Math.round(base * defaultMultiplier * 100) / 100 : null;
                if (calculated_price != null && calculated_price > 0 && usePsychological) {
                  calculated_price = applyPsychologicalPricing(calculated_price);
                }
                return {
                  skn: i.skn ?? (i as { code?: string }).code ?? '',
                  product_name: i.product_name ?? i.name ?? '',
                  quantity: i.quantity,
                  price: i.price,
                  calculated_price,
                  formula: defaultFormulaId,
                  matched_from_supplier_history: (i as { matched_from_supplier_history?: boolean }).matched_from_supplier_history ?? false,
                };
              });
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
  }, [id, user?.id]);

  const handleConfirm = async () => {
    if (!user?.id || items.length === 0 || !id) return;
    setSaving(true);
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
      const resData = await res.json().catch(() => ({}));
      if (resData.learningSaved) {
        setLearningSavedMessage(true);
        setTimeout(() => router.push(`/invoices/${id}/square`), 1500);
      } else {
        router.push(`/invoices/${id}/square`);
      }
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
        const defaultMultiplier = formulaOptions[0]?.multiplier ?? DEFAULT_FORMULAS[0].multiplier;
        const defaultFormulaId = formulaOptions[0]?.id ?? 'custom';
        const usePsychological = getPsychologicalPricingEnabled();
        const parsedItems = (parseData.items as Array<{ skn?: string; product_name?: string; name?: string; quantity: number; price?: number }>).map((i) => {
          const base = i.price != null ? Number(i.price) : null;
          let calculated_price = base != null && base > 0 ? Math.round(base * defaultMultiplier * 100) / 100 : null;
          if (calculated_price != null && calculated_price > 0 && usePsychological) {
            calculated_price = applyPsychologicalPricing(calculated_price);
          }
          return {
            skn: i.skn ?? (i as { code?: string }).code ?? '',
            product_name: i.product_name ?? i.name ?? '',
            quantity: i.quantity,
            price: i.price,
            calculated_price,
            formula: defaultFormulaId,
            matched_from_supplier_history: (i as { matched_from_supplier_history?: boolean }).matched_from_supplier_history ?? false,
          };
        });
        setItems(parsedItems);
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
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Invoice: {invoice.file_name}</h1>
          <p className="text-slate-500 mt-1">Review and confirm parsed items</p>
          {supplierAccuracy != null && (
            <p className="flex items-center gap-1.5 mt-2 text-sm text-emerald-600 font-medium">
              <Sparkles className="w-4 h-4" />
              AI accuracy for this supplier: {supplierAccuracy}%
            </p>
          )}
          {learningSavedMessage && (
            <p className="flex items-center gap-1.5 mt-2 text-sm text-emerald-600 font-medium animate-pulse">
              <Check className="w-4 h-4" />
              Learning saved for this supplier
            </p>
          )}
        </div>
        <Button variant="secondary" onClick={handleParseAgain} disabled={parsing}>
          {parsing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Parsing…</> : 'Parse again'}
        </Button>
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
            <p className="text-slate-500">No items could be extracted. Use <strong>Parse again</strong> above to re-run extraction on the invoice.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 text-sm font-medium text-slate-600">SKU</th>
                    <th className="text-left py-2 text-sm font-medium text-slate-600">Product</th>
                    <th className="text-left py-2 text-sm font-medium text-slate-600">Quantity</th>
                    <th className="text-left py-2 text-sm font-medium text-slate-600">Price</th>
                    <th className="text-left py-2 text-sm font-medium text-slate-600">Formula</th>
                    <th className="text-left py-2 text-sm font-medium text-slate-600">Calculated price</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-3 text-slate-800">
                        {editing?.index === i && editing?.field === 'skn' ? (
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit();
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            className="w-full max-w-[8rem] px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none"
                            autoComplete="on"
                            autoFocus
                          />
                        ) : (
                          <span className="flex items-center gap-2">
                            <span
                              className="cursor-text flex-1 min-w-0"
                              onClick={(e) => startEdit(i, 'skn', getCaretOffsetFromClick(e))}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(i, 'skn'); } }}
                            >
                              {item.skn ?? '—'}
                            </span>
                            {item.matched_from_supplier_history && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 whitespace-nowrap">
                                Matched from supplier history
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => startEdit(i, 'skn')}
                              className="p-1 rounded text-slate-400 hover:text-primary-600 hover:bg-slate-100"
                              title="Edit SKU"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-slate-800">
                        {editing?.index === i && editing?.field === 'name' ? (
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit();
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            className="w-full max-w-md px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none"
                            autoComplete="on"
                            autoFocus
                          />
                        ) : (
                          <span className="flex items-center gap-2">
                            <span
                              className="cursor-text flex-1 min-w-0"
                              onClick={(e) => startEdit(i, 'name', getCaretOffsetFromClick(e))}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(i, 'name'); } }}
                            >
                              {item.product_name}
                            </span>
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
                            ref={editInputRef}
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
                            autoComplete="on"
                            autoFocus
                          />
                        ) : (
                          <span className="flex items-center gap-2">
                            <span
                              className="cursor-text"
                              onClick={() => startEdit(i, 'quantity')}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(i, 'quantity'); } }}
                            >
                              {item.quantity}
                            </span>
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
                      <td className="py-3 text-slate-800">
                        <select
                          className="px-2 py-1 rounded border border-slate-200 text-sm bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none min-w-[5rem]"
                          value={item.formula ?? formulaOptions[0]?.id ?? 'custom'}
                          onChange={(e) => {
                            const formulaId = e.target.value;
                            if (formulaId !== 'custom') applyCalcFormulaToRow(i, formulaId);
                          }}
                          title="Formula for this row"
                        >
                          {formulaOptions.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.label}
                            </option>
                          ))}
                          <option value="custom">Custom</option>
                        </select>
                      </td>
                      <td className="py-3 text-slate-800">
                        {editing?.index === i && editing?.field === 'calculated_price' ? (
                          <input
                            ref={editInputRef}
                            type="number"
                            min={0}
                            step={0.01}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit();
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            className="w-24 px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none"
                            autoComplete="on"
                            autoFocus
                          />
                        ) : (
                          <span className="flex items-center gap-2">
                            <span
                              className="cursor-text"
                              onClick={() => startEdit(i, 'calculated_price')}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(i, 'calculated_price'); } }}
                            >
                              {item.calculated_price != null ? `$${Number(item.calculated_price).toFixed(2)}` : '—'}
                            </span>
                            <button
                              type="button"
                              onClick={() => startEdit(i, 'calculated_price')}
                              className="p-1 rounded text-slate-400 hover:text-primary-600 hover:bg-slate-100"
                              title="Edit calculated price"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </span>
                        )}
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
