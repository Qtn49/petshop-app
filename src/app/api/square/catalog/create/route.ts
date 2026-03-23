import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { getSquareEnvironment } from '@/lib/integrations/square/squareOAuth';
import { Client, Environment } from 'square';
import { randomUUID } from 'crypto';

type CreateItem = {
  product_name: string;
  quantity?: number;
  price?: number;
  // Extended fields for manual item creation
  sku?: string;
  category?: string;
  description?: string;
  retail_price?: number;
  purchase_price?: number;
  initial_stock?: number;
  image?: string; // data URL
  vendor?: string;
  vendor_code?: string;
  vendor_id?: string;
  // Variant creation
  parentCatalogItemId?: string;
  variantName?: string; // color/size/weight label
};

function parseDataUrl(dataUrl: string): { buffer: Buffer; mime: string; ext: string } | null {
  if (!dataUrl.startsWith('data:image/')) return null;
  const semiIdx = dataUrl.indexOf(';', 11);
  if (semiIdx === -1) return null;
  const commaIdx = dataUrl.indexOf(',', semiIdx);
  if (commaIdx === -1) return null;
  const mime = dataUrl.substring(5, semiIdx);
  const base64 = dataUrl.substring(commaIdx + 1);
  const buffer = Buffer.from(base64, 'base64');
  const ext = mime === 'image/png' ? 'png' : mime === 'image/gif' ? 'gif' : 'jpg';
  return { buffer, mime, ext };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, items } = body as { userId?: string; items?: CreateItem[] };

    if (!userId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'userId and non-empty items array required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();
    const { data: conn } = await supabase
      .from('square_connections')
      .select('access_token, location_id')
      .eq('user_id', userId)
      .single();

    if (!conn?.access_token) {
      return NextResponse.json(
        { error: 'Square not connected' },
        { status: 401 }
      );
    }

    const squareEnv = getSquareEnvironment();
    const squareBaseUrl = squareEnv === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';
    const sqHeaders = {
      'Square-Version': '2024-01-18',
      'Authorization': `Bearer ${conn.access_token}`,
      'Content-Type': 'application/json',
    };
    const env = squareEnv === 'production' ? Environment.Production : Environment.Sandbox;
    const client = new Client({ accessToken: conn.access_token, environment: env });
    const locationId = conn.location_id ?? null;

    // Resolve category name → Square category ID
    const categoryNameToId = new Map<string, string>();
    const resolveCategoryId = async (categoryName: string): Promise<string | null> => {
      if (!categoryName.trim()) return null;
      const key = categoryName.trim().toLowerCase();
      if (categoryNameToId.has(key)) return categoryNameToId.get(key)!;

      // Lazy-load category list on first use
      if (categoryNameToId.size === 0) {
        try {
          let cursor: string | undefined;
          do {
            const url = `${squareBaseUrl}/v2/catalog/list?types=CATEGORY${cursor ? `&cursor=${cursor}` : ''}`;
            const res = await fetch(url, { headers: sqHeaders });
            const data = await res.json();
            for (const obj of data.objects ?? []) {
              const n = obj.category_data?.name?.trim();
              if (n && obj.id) categoryNameToId.set(n.toLowerCase(), obj.id);
            }
            cursor = data.cursor ?? undefined;
          } while (cursor);
        } catch { /* ignore */ }
      }

      if (categoryNameToId.has(key)) return categoryNameToId.get(key)!;

      // Create new category
      try {
        const catBody = {
          idempotency_key: randomUUID(),
          object: {
            type: 'CATEGORY',
            id: `#cat-${randomUUID().slice(0, 8)}`,
            category_data: { name: categoryName.trim() },
          },
        };
        const res = await fetch(`${squareBaseUrl}/v2/catalog/object`, { method: 'POST', headers: sqHeaders, body: JSON.stringify(catBody) });
        const data = await res.json();
        const catId = data.catalog_object?.id;
        if (catId) {
          categoryNameToId.set(key, catId);
          return catId;
        }
      } catch { /* ignore */ }
      return null;
    };

    const created: { name: string; id?: string; variationId?: string }[] = [];
    const errors: { name: string; error: string }[] = [];

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const name = (it.product_name ?? '').trim();
      if (!name) continue;

      const retailCents = (it.retail_price ?? it.price) != null
        ? Math.round(Number(it.retail_price ?? it.price) * 100)
        : 0;
      const idempotencyKey = randomUUID();
      const itemId = `#item-${idempotencyKey.slice(0, 8)}`;
      const varId = `#var-${idempotencyKey.slice(0, 8)}`;

      try {
        let catalogId: string | undefined;
        let variationId: string | undefined;

        if (it.parentCatalogItemId) {
          // Add as a new variation to an existing catalog item
          const variationName = it.variantName?.trim() || name;
          const { result } = await client.catalogApi.upsertCatalogObject({
            idempotencyKey,
            object: {
              type: 'ITEM_VARIATION',
              id: varId,
              itemVariationData: {
                itemId: it.parentCatalogItemId,
                name: variationName,
                pricingType: 'FIXED_PRICING',
                trackInventory: true,
                ...(retailCents > 0 && {
                  priceMoney: { amount: BigInt(retailCents), currency: 'AUD' as const },
                }),
                ...(it.sku?.trim() && { sku: it.sku.trim() }),
              },
            },
          });
          variationId = result.catalogObject?.id;
          catalogId = it.parentCatalogItemId;
        } else {
          // Create a brand new item
          const categoryId = it.category ? await resolveCategoryId(it.category) : null;
          const { result } = await client.catalogApi.upsertCatalogObject({
            idempotencyKey,
            object: {
              type: 'ITEM',
              id: itemId,
              itemData: {
                name,
                ...(it.description?.trim() && { description: it.description.trim() }),
                ...(categoryId && { categories: [{ id: categoryId }] }),
                variations: [
                  {
                    type: 'ITEM_VARIATION',
                    id: varId,
                    itemVariationData: {
                      name: 'Default',
                      pricingType: 'FIXED_PRICING',
                      trackInventory: true,
                      ...(retailCents > 0 && {
                        priceMoney: { amount: BigInt(retailCents), currency: 'AUD' as const },
                      }),
                      ...(it.sku?.trim() && { sku: it.sku.trim() }),
                    },
                  },
                ],
              },
            },
          });

          catalogId = result.catalogObject?.id ?? result.idMappings?.[0]?.objectId ?? undefined;
          variationId = result.idMappings?.find(
            (m) => m.clientObjectId === varId
          )?.objectId ?? undefined;
        }

        // Upload image if provided and we have a catalog item
        if (it.image?.startsWith('data:image/') && catalogId) {
          const parsed = parseDataUrl(it.image);
          if (parsed) {
            try {
              const imgIdempotencyKey = randomUUID();
              const imgRequest = {
                idempotency_key: imgIdempotencyKey,
                object_id: catalogId,
                is_primary: true,
                image: {
                  id: `#img-${idempotencyKey.slice(0, 8)}`,
                  type: 'IMAGE',
                  image_data: { name: name.slice(0, 100) },
                },
              };
              const formData = new FormData();
              formData.append('request', JSON.stringify(imgRequest));
              formData.append('image_file', new Blob([new Uint8Array(parsed.buffer)], { type: parsed.mime }), `image.${parsed.ext}`);
              await fetch(`${squareBaseUrl}/v2/catalog/images`, {
                method: 'POST',
                headers: { 'Square-Version': sqHeaders['Square-Version'], 'Authorization': sqHeaders['Authorization'] },
                body: formData,
              });
            } catch { /* non-fatal */ }
          }
        }

        // Set initial stock via Inventory API
        const stockQty = it.initial_stock != null ? Number(it.initial_stock) : 0;
        if (stockQty > 0 && locationId && variationId) {
          try {
            const invBody = {
              idempotency_key: randomUUID(),
              changes: [{
                type: 'PHYSICAL_COUNT',
                physical_count: {
                  catalog_object_id: variationId,
                  state: 'IN_STOCK',
                  location_id: locationId,
                  quantity: String(stockQty),
                  occurred_at: new Date().toISOString(),
                },
              }],
            };
            await fetch(`${squareBaseUrl}/v2/inventory/changes/batch-create`, {
              method: 'POST',
              headers: sqHeaders,
              body: JSON.stringify(invBody),
            });
          } catch { /* non-fatal */ }
        }

        created.push({ name, id: catalogId ?? undefined, variationId: variationId ?? undefined });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const statusCode = typeof (err as { statusCode?: number }).statusCode === 'number' ? (err as { statusCode: number }).statusCode : null;
        if (statusCode === 403 || /403|forbidden/i.test(message)) {
          errors.push({ name, error: `Permission denied (403). Reconnect Square in Settings to grant catalog write permission.` });
        } else {
          errors.push({ name, error: message });
        }
      }
    }

    const has403 = errors.some((e) => /403|permission denied/i.test(e.error));
    return NextResponse.json({
      success: errors.length === 0,
      created,
      errors: errors.length > 0 ? errors : undefined,
      ...(has403 && {
        hint: 'Reconnect Square in Settings (disconnect then connect again) to grant catalog write permission.',
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
