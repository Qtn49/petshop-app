/**
 * Fetch Square catalog items for a user. Used by chat API when user asks about inventory/sales/products.
 */
import { getSupabaseClient } from '@/lib/supabase-server';
import { getSquareEnvironment } from '@/lib/integrations/square/squareOAuth';
import { Client, Environment } from 'square';

export type CatalogItem = {
  id: string;
  name?: string;
  sku?: string;
  category?: string;
  vendor?: string;
  vendor_code?: string;
  variations?: {
    id?: string;
    name?: string;
    price?: number;
    sku?: string;
  }[];
};

export async function fetchSquareCatalogForUser(userId: string): Promise<{ items: CatalogItem[] } | { error: string }> {
  const supabase = getSupabaseClient();
  const { data: conn } = await supabase
    .from('square_connections')
    .select('access_token')
    .eq('user_id', userId)
    .single();

  if (!conn?.access_token) {
    return { error: 'Square not connected. Please connect your Square account.' };
  }

  const squareEnv = getSquareEnvironment();
  const env = squareEnv === 'production' ? Environment.Production : Environment.Sandbox;

  const client = new Client({
    accessToken: conn.access_token,
    environment: env,
  });

  try {
    const categoryIdToName = new Map<string, string>();
    let catCursor: string | undefined;
    do {
      const { result } = await client.catalogApi.listCatalog(catCursor, 'CATEGORY');
      for (const obj of result.objects ?? []) {
        const id = (obj as { id?: string }).id;
        const name = (obj as { categoryData?: { name?: string } }).categoryData?.name?.trim();
        if (id && name) categoryIdToName.set(id, name);
      }
      catCursor = result.cursor ?? undefined;
    } while (catCursor);

    const getCustom = (
      obj: { customAttributeValues?: Record<string, { stringValue?: string; numberValue?: string }> },
      key: string
    ): string => {
      const vals = obj.customAttributeValues;
      if (!vals) return '';
      for (const [k, v] of Object.entries(vals)) {
        if (k.toLowerCase().replace(/[- ]/g, '_') === key) {
          const s = v?.stringValue ?? (v?.numberValue != null ? String(v.numberValue) : '');
          return (s ?? '').trim();
        }
      }
      return '';
    };

    type RawObj = {
      id?: string;
      customAttributeValues?: Record<string, { stringValue?: string; numberValue?: string }>;
      itemData?: {
        name?: string;
        sku?: string;
        category_id?: string;
        categories?: { id?: string }[];
        variations?: {
          id?: string;
          itemVariationData?: { name?: string; priceMoney?: { amount?: string | number }; sku?: string };
        }[];
      };
    };

    const allObjects: RawObj[] = [];
    let itemCursor: string | undefined;
    do {
      const { result } = await client.catalogApi.listCatalog(itemCursor, 'ITEM');
      for (const obj of (result.objects ?? []) as RawObj[]) {
        allObjects.push(obj);
      }
      itemCursor = result.cursor ?? undefined;
    } while (itemCursor);

    const items: CatalogItem[] = allObjects.map((obj) => {
      const itemData = obj.itemData;
      const catId = itemData?.category_id;
      const cats = itemData?.categories;
      let category = '';
      if (catId) category = categoryIdToName.get(catId) ?? '';
      if (!category && Array.isArray(cats)) {
        for (const c of cats) {
          const n = categoryIdToName.get(c.id ?? '');
          if (n) {
            category = n;
            break;
          }
        }
      }
      const vendor = getCustom(obj, 'vendor') || getCustom(obj, 'vendors') || '';
      const vendor_code = getCustom(obj, 'vendor_code') || getCustom(obj, 'supplier_code') || '';
      return {
        id: obj.id ?? '',
        name: itemData?.name,
        sku: itemData?.sku,
        category: category || undefined,
        vendor: vendor || undefined,
        vendor_code: vendor_code || undefined,
        variations: itemData?.variations?.map((v) => {
          const vdata = v?.itemVariationData;
          const amount = vdata?.priceMoney?.amount;
          const price = amount != null ? Number(amount) / 100 : undefined;
          return {
            id: v?.id,
            name: vdata?.name,
            price,
            sku: vdata?.sku,
          };
        }),
      };
    });

    return { items };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to fetch catalog',
    };
  }
}
