import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { getSquareEnvironment } from '@/lib/integrations/square/squareOAuth';
import { Client, Environment } from 'square';

export type CatalogItemRow = {
  name: string;
  sku: string;
  category: string;
  description: string;
  vendor: string;
  vendor_code: string;
};

/**
 * GET /api/square/catalog/items-index?userId=...
 * Returns catalog items keyed by product name for lookup when user selects a name (fill sku, category, etc.; add as PO only).
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

  const categoryIdToName = new Map<string, string>();
  const itemsByName = new Map<string, CatalogItemRow>();

  try {
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

    cursor = undefined;
    do {
      const { result } = await client.catalogApi.listCatalog(cursor, 'ITEM');
      for (const obj of result.objects ?? []) {
        const itemData = (obj as { itemData?: Record<string, unknown> }).itemData;
        const customAttrs = (obj as { customAttributeValues?: Record<string, { stringValue?: string; numberValue?: string }> }).customAttributeValues;
        if (!itemData) continue;

        const name = (itemData.name as string)?.trim();
        if (!name) continue;

        let category = '';
        const catId = itemData.category_id as string | undefined;
        if (catId) category = categoryIdToName.get(catId) ?? '';
        const cats = itemData.categories as Array<{ id?: string }> | undefined;
        if (!category && Array.isArray(cats) && cats[0]) {
          category = categoryIdToName.get(cats[0].id ?? '') ?? '';
        }

        let vendor = '';
        let vendorCode = '';
        if (customAttrs) {
          for (const [key, v] of Object.entries(customAttrs)) {
            const s = (v?.stringValue ?? (v?.numberValue != null ? String(v.numberValue) : ''))?.trim();
            if (!s) continue;
            const k = key.toLowerCase().replace(/[- ]/g, '_');
            if (k === 'vendor' || k === 'vendors') vendor = s;
            else if (k === 'vendor_code' || k === 'supplier_code') vendorCode = s;
          }
        }

        const sku = (itemData.sku as string)?.trim() ?? '';
        const description = ((itemData.description as string)?.trim() || (itemData.description_plaintext as string)?.trim()) ?? '';

        itemsByName.set(name, { name, sku, category, description, vendor, vendor_code: vendorCode });
      }
      cursor = result.cursor ?? undefined;
    } while (cursor);

    const items = Array.from(itemsByName.values());
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch items index' },
      { status: 500 }
    );
  }
}
