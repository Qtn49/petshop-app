import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { getSquareEnvironment } from '@/lib/integrations/square/squareOAuth';
import { Client, Environment } from 'square';

/**
 * GET /api/square/catalog/autocomplete-values?userId=...
 * Returns unique values per field from Square catalog for autocomplete.
 */
export async function GET(request: Request) {
  const supabase = getSupabaseClient();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const { data: conn } = await supabase
    .from('square_connections')
    .select('access_token')
    .eq('user_id', userId)
    .single();

  if (!conn?.access_token) {
    return NextResponse.json(
      { error: 'Square not connected' },
      { status: 401 }
    );
  }

  const squareEnv = getSquareEnvironment();
  const env = squareEnv === 'production' ? Environment.Production : Environment.Sandbox;
  const client = new Client({
    accessToken: conn.access_token,
    environment: env,
  });

  const productNames = new Set<string>();
  const skus = new Set<string>();
  const descriptions = new Set<string>();
  const customValues: Record<string, Set<string>> = {};

  const vendorValues = new Set<string>();
  const vendorCodeValues = new Set<string>();

  function addCustom(key: string, val: string) {
    if (!key || !val?.trim()) return;
    if (!customValues[key]) customValues[key] = new Set<string>();
    customValues[key].add(val.trim());
    const k = key.toLowerCase().replace(/[- ]/g, '_');
    if (k === 'vendor') vendorValues.add(val.trim());
    else if (k === 'vendor_code' || k === 'supplier_code') vendorCodeValues.add(val.trim());
  }

  try {
    const categoryIdToName = new Map<string, string>();
    let cursor: string | undefined;
    do {
      const { result } = await client.catalogApi.listCatalog(cursor, 'CATEGORY');
      for (const obj of result.objects ?? []) {
        const id = (obj as { id?: string }).id;
        const name = (obj as { categoryData?: { name?: string } }).categoryData?.name?.trim();
        if (id && name) categoryIdToName.set(id, name);
      }
      cursor = result.cursor ?? undefined;
    } while (cursor);

    const categoryNames = new Set<string>();
    // Add all Square categories (not just those assigned to items)
    Array.from(categoryIdToName.values()).forEach((name) => categoryNames.add(name));
    do {
      const { result } = await client.catalogApi.listCatalog(cursor, 'ITEM');
      for (const obj of result.objects ?? []) {
        const itemData = (obj as { itemData?: Record<string, unknown> }).itemData;
        if (!itemData) continue;

        const name = (itemData.name as string)?.trim();
        if (name) productNames.add(name);

        const sku = (itemData.sku as string)?.trim();
        if (sku) skus.add(sku);

        const desc = (itemData.description as string)?.trim() || (itemData.description_plaintext as string)?.trim();
        if (desc) descriptions.add(desc.slice(0, 200));

        const catId = itemData.category_id as string | undefined;
        if (catId) {
          const catName = categoryIdToName.get(catId);
          if (catName) categoryNames.add(catName);
        }
        const cats = itemData.categories as Array<{ id?: string }> | undefined;
        if (Array.isArray(cats)) {
          for (const c of cats) {
            const n = categoryIdToName.get(c.id ?? '');
            if (n) categoryNames.add(n);
          }
        }

        const customAttrs = (obj as { customAttributeValues?: Record<string, { stringValue?: string; numberValue?: string }> }).customAttributeValues;
        if (customAttrs) {
          for (const [key, v] of Object.entries(customAttrs)) {
            const s = v?.stringValue ?? (v?.numberValue != null ? String(v.numberValue) : '');
            if (s?.trim()) addCustom(key, s.trim());
          }
        }
      }
      cursor = result.cursor ?? undefined;
    } while (cursor);

    // List ITEM_VARIATION to get variation SKUs (itemData.variations are references only)
    cursor = undefined;
    do {
      const { result } = await client.catalogApi.listCatalog(cursor, 'ITEM_VARIATION');
      for (const obj of result.objects ?? []) {
        const vdata = (obj as { itemVariationData?: { sku?: string }; customAttributeValues?: Record<string, { stringValue?: string; numberValue?: string }> }).itemVariationData;
        const vSku = vdata?.sku?.trim();
        if (vSku) skus.add(vSku);
        const vCustom = (obj as { customAttributeValues?: Record<string, { stringValue?: string; numberValue?: string }> }).customAttributeValues;
        if (vCustom) {
          for (const [key, val] of Object.entries(vCustom)) {
            const s = val?.stringValue ?? (val?.numberValue != null ? String(val.numberValue) : '');
            if (s?.trim()) addCustom(key, s.trim());
          }
        }
      }
      cursor = result.cursor ?? undefined;
    } while (cursor);

    const out: Record<string, string[]> = {
      product_name: Array.from(productNames).sort((a, b) => a.localeCompare(b)),
      sku: Array.from(skus).sort((a, b) => a.localeCompare(b)),
      description: Array.from(descriptions).sort((a, b) => a.localeCompare(b)).slice(0, 100),
      category: Array.from(categoryNames).sort((a, b) => a.localeCompare(b)),
      vendor: Array.from(vendorValues).sort((a, b) => a.localeCompare(b)),
      vendor_code: Array.from(vendorCodeValues).sort((a, b) => a.localeCompare(b)),
    };
    for (const [key, set] of Object.entries(customValues)) {
      out[key] = Array.from(set).sort((a, b) => a.localeCompare(b));
    }

    return NextResponse.json({ values: out });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch catalog values' },
      { status: 500 }
    );
  }
}
