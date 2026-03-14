import type { SupabaseClient } from '@supabase/supabase-js';
import { extractBarcodes } from './skuRule';

export type SupplierProduct = {
  barcode: string;
  supplier_product_name: string;
  square_variation_id: string | null;
};

/**
 * Fetch known supplier products by supplier name and optional barcode list.
 * Used for pre-matching and AI prompt injection.
 */
export async function getSupplierProducts(
  supabase: SupabaseClient,
  organizationId: string,
  supplierName: string | null
): Promise<SupplierProduct[]> {
  if (!supplierName?.trim()) return [];

  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id')
    .eq('organization_id', organizationId)
    .ilike('name', supplierName.trim())
    .limit(1)
    .maybeSingle();

  if (!supplier?.id) return [];

  const { data: products } = await supabase
    .from('supplier_products')
    .select('barcode, supplier_product_name, square_variation_id')
    .eq('supplier_id', supplier.id);

  return (products ?? []).map((p) => ({
    barcode: p.barcode,
    supplier_product_name: p.supplier_product_name,
    square_variation_id: p.square_variation_id ?? null,
  }));
}

/**
 * Pre-match barcodes from raw text to known supplier products.
 * Returns a map: barcode -> { name, square_variation_id }.
 */
export async function preMatchBarcodes(
  supabase: SupabaseClient,
  organizationId: string,
  supplierName: string | null,
  rawText: string
): Promise<Map<string, { name: string; square_variation_id: string | null }>> {
  const products = await getSupplierProducts(
    supabase,
    organizationId,
    supplierName
  );
  const barcodesInText = extractBarcodes(rawText);
  const known = new Map<string, { name: string; square_variation_id: string | null }>();

  for (const b of barcodesInText) {
    const prod = products.find((p) => p.barcode === b);
    if (prod) {
      known.set(b, {
        name: prod.supplier_product_name,
        square_variation_id: prod.square_variation_id,
      });
    }
  }

  return known;
}
