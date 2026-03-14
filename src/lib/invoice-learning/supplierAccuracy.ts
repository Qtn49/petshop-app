import type { SupabaseClient } from '@supabase/supabase-js';
import { detectSupplierFromText } from './supplierDetection';

/**
 * Compute AI accuracy for a supplier from invoice_history.
 * Compares ai_prediction_json to user_corrected_json (field-level match).
 * Returns 0-100 or null if not enough data.
 */
export async function getSupplierAccuracy(
  supabase: SupabaseClient,
  organizationId: string,
  rawTextForSupplierDetection: string
): Promise<number | null> {
  const supplierName = detectSupplierFromText(rawTextForSupplierDetection);
  if (!supplierName?.trim()) return null;

  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id')
    .eq('organization_id', organizationId)
    .ilike('name', supplierName.trim())
    .limit(1)
    .maybeSingle();

  if (!supplier?.id) return null;

  const { data: history } = await supabase
    .from('invoice_history')
    .select('ai_prediction_json, user_corrected_json')
    .eq('supplier_id', supplier.id)
    .limit(50);

  if (!history || history.length < 2) return null;

  let totalFields = 0;
  let matchedFields = 0;

  for (const row of history) {
    const ai = normalizeItems(row.ai_prediction_json);
    const user = normalizeItems(row.user_corrected_json);
    const len = Math.min(ai.length, user.length);
    for (let i = 0; i < len; i++) {
      const a = ai[i];
      const u = user[i];
      totalFields += 4;
      if (getField(a, 'name', 'product_name') === getField(u, 'product_name', 'name')) matchedFields++;
      if (getField(a, 'code', 'skn') === getField(u, 'skn', 'code')) matchedFields++;
      if (getField(a, 'quantity') === getField(u, 'quantity')) matchedFields++;
      if (getField(a, 'price') === getField(u, 'price')) matchedFields++;
    }
  }

  if (totalFields === 0) return null;
  return Math.round((matchedFields / totalFields) * 100);
}

function normalizeItems(json: unknown): Array<Record<string, unknown>> {
  if (json == null) return [];
  const parsed = typeof json === 'string' ? JSON.parse(json) : json;
  return Array.isArray(parsed) ? parsed : [];
}

function getField(
  item: Record<string, unknown> | undefined,
  ...fields: string[]
): string {
  if (!item) return '';
  for (const f of fields) {
    const v = item[f];
    if (v != null) return String(v).trim().toLowerCase();
  }
  return '';
}
