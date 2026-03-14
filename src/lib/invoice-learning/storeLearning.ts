import type { SupabaseClient } from '@supabase/supabase-js';
import { detectSupplierFromText } from './supplierDetection';
import { isValidSku } from './skuRule';

type Item = {
  skn?: string;
  product_name: string;
  quantity: number;
  price?: number;
  /** square_variation_id from Square catalog when matched */
  square_variation_id?: string | null;
};

/**
 * Get or create supplier by organization and name.
 */
export async function getOrCreateSupplier(
  supabase: SupabaseClient,
  organizationId: string,
  name: string
): Promise<string | null> {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return null;

  const { data: existing } = await supabase
    .from('suppliers')
    .select('id')
    .eq('organization_id', organizationId)
    .ilike('name', trimmed)
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: inserted, error } = await supabase
    .from('suppliers')
    .insert({ organization_id: organizationId, name: trimmed })
    .select('id')
    .single();

  if (error || !inserted?.id) return null;
  return inserted.id;
}

/**
 * Store invoice history and upsert supplier_products from confirmed items.
 * Call after user confirms Step 1 (or when we have both AI prediction and corrected data).
 */
export async function storeInvoiceLearning(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    invoiceId: string;
    rawText: string;
    aiPredictionJson: unknown;
    userCorrectedItems: Item[];
  }
): Promise<{ supplierId: string | null; learningSaved: boolean }> {
  const { organizationId, invoiceId, rawText, aiPredictionJson, userCorrectedItems } = params;

  const supplierName = detectSupplierFromText(rawText);
  const supplierId = supplierName
    ? await getOrCreateSupplier(supabase, organizationId, supplierName)
    : null;

  const aiJson =
    aiPredictionJson != null
      ? (typeof aiPredictionJson === 'string' ? aiPredictionJson : JSON.stringify(aiPredictionJson))
      : '[]';
  const userJson = JSON.stringify(
    userCorrectedItems.map((i) => ({
      skn: i.skn ?? null,
      product_name: i.product_name,
      quantity: i.quantity,
      price: i.price ?? null,
    }))
  );

  await supabase.from('invoice_history').insert({
    organization_id: organizationId,
    invoice_id: invoiceId,
    supplier_id: supplierId,
    raw_text: rawText,
    ai_prediction_json: aiJson as unknown,
    user_corrected_json: userJson as unknown,
  });

  let learningSaved = false;
  if (supplierId && userCorrectedItems.length > 0) {
    for (const item of userCorrectedItems) {
      const barcode = item.skn && isValidSku(item.skn) ? item.skn.trim() : null;
      if (!barcode) continue;

      const price = item.price != null ? Number(item.price) : null;

      const { error: upsertErr } = await supabase.from('supplier_products').upsert(
        {
          supplier_id: supplierId,
          supplier_product_name: (item.product_name ?? '').trim(),
          barcode,
          square_variation_id: item.square_variation_id?.trim() || null,
          last_price: price,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'supplier_id,barcode',
        }
      );

      if (!upsertErr) learningSaved = true;
    }
  }

  return { supplierId, learningSaved };
}
