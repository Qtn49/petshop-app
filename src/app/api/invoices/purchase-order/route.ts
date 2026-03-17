import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { getSquareEnvironment } from '@/lib/integrations/square/squareOAuth';
import { randomUUID } from 'crypto';
import type { ConfirmItem } from '@/lib/invoice-import/confirm-types';
import { getMissingFields } from '@/lib/invoice-import/confirm-types';

type Body = { userId: string; invoiceId: string; items: ConfirmItem[] };

function buildExtraFields(it: ConfirmItem): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  if (it.retail_price != null && !Number.isNaN(it.retail_price)) extra.retail_price = it.retail_price;
  if (it.category?.trim()) extra.category = it.category.trim();
  if (it.description?.trim()) extra.description = it.description.trim();
  if (it.vendor?.trim()) extra.vendor = it.vendor.trim();
  if (it.vendor_code?.trim()) extra.vendor_code = it.vendor_code.trim();
  if (it.initial_stock != null && !Number.isNaN(it.initial_stock)) extra.initial_stock = it.initial_stock;
  if (it.customAttributes) {
    for (const [key, val] of Object.entries(it.customAttributes)) {
      if (val == null || String(val).trim() === '') continue;
      extra[key] = String(val).trim();
    }
  }
  return extra;
}

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
  console.log('[PO] === START ===');
  try {
    console.log('[PO] Parsing request body...');
    const body = (await request.json()) as Body;
    const { userId, invoiceId, items } = body;
    console.log(`[PO] userId=${userId}, invoiceId=${invoiceId}, items=${items?.length}`);

    if (!userId || !invoiceId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'userId, invoiceId and non-empty items array required' },
        { status: 400 }
      );
    }

    for (let i = 0; i < items.length; i++) {
      const missing = getMissingFields(items[i]);
      if (missing.length > 0) {
        return NextResponse.json(
          { error: `Item ${i + 1}: missing required fields: ${missing.join(', ')}` },
          { status: 400 }
        );
      }
    }
    console.log('[PO] Validation passed');

    const supabase = getSupabaseClient();

    console.log('[PO] Fetching invoice...');
    const { data: inv } = await supabase.from('invoices').select('id, user_id').eq('id', invoiceId).single();
    if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    const isOwner = inv.user_id === userId;
    if (!isOwner) {
      const { data: cu } = await supabase.from('users').select('organization_id').eq('id', userId).single();
      const { data: ou } = await supabase.from('users').select('organization_id').eq('id', inv.user_id).single();
      const sameOrg = cu?.organization_id && ou?.organization_id && cu.organization_id === ou.organization_id;
      if (!sameOrg) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    console.log('[PO] Invoice found');

    console.log('[PO] Fetching Square connection...');
    const { data: conn } = await supabase
      .from('square_connections')
      .select('access_token, location_id')
      .eq('user_id', userId)
      .single();

    if (!conn?.access_token) {
      return NextResponse.json({ error: 'Square not connected' }, { status: 401 });
    }
    const locationId: string | null = conn.location_id ?? null;
    console.log(`[PO] Square connected (location=${locationId ?? 'none'})`);

    const squareEnv = getSquareEnvironment();
    const squareBaseUrl = squareEnv === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';
    const squareHeaders = {
      'Square-Version': '2024-01-18',
      'Authorization': `Bearer ${conn.access_token}`,
      'Content-Type': 'application/json',
    };

    // Build category name → ID map from existing Square categories
    const categoryNameToId = new Map<string, string>();
    console.log('[PO] Fetching Square categories...');
    try {
      let catCursor: string | undefined;
      do {
        const catUrl = `${squareBaseUrl}/v2/catalog/list?types=CATEGORY${catCursor ? `&cursor=${catCursor}` : ''}`;
        const catRes = await fetch(catUrl, { headers: squareHeaders });
        const catData = await catRes.json();
        for (const obj of catData.objects ?? []) {
          const catName = obj.category_data?.name?.trim();
          if (catName && obj.id) categoryNameToId.set(catName.toLowerCase(), obj.id);
        }
        catCursor = catData.cursor ?? undefined;
      } while (catCursor);
      console.log(`[PO] Loaded ${categoryNameToId.size} categories`);
    } catch (catErr) {
      console.error('[PO] Failed to load categories:', catErr instanceof Error ? catErr.message : catErr);
    }

    async function resolveCategoryId(categoryName: string): Promise<string | null> {
      if (!categoryName.trim()) return null;
      const existing = categoryNameToId.get(categoryName.trim().toLowerCase());
      if (existing) return existing;

      // Create the category
      try {
        console.log(`[PO] Creating category "${categoryName}"`);
        const catBody = {
          idempotency_key: randomUUID(),
          object: {
            type: 'CATEGORY',
            id: `#cat-${randomUUID().slice(0, 8)}`,
            category_data: { name: categoryName.trim() },
          },
        };
        const res = await fetch(`${squareBaseUrl}/v2/catalog/object`, {
          method: 'POST',
          headers: squareHeaders,
          body: JSON.stringify(catBody),
        });
        const data = await res.json();
        const catId = data.catalog_object?.id;
        if (catId) {
          categoryNameToId.set(categoryName.trim().toLowerCase(), catId);
          console.log(`[PO] Created category "${categoryName}" → ${catId}`);
          return catId;
        }
      } catch (e) {
        console.error(`[PO] Failed to create category "${categoryName}":`, e instanceof Error ? e.message : e);
      }
      return null;
    }

    const catalogIds: Record<number, string> = {};
    const variationIds: Record<number, string> = {};

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const name = (it.product_name ?? '').trim();
      console.log(`[PO] Item ${i}: "${name}" status=${it.status} addAsPoOnly=${it.addAsPoOnly} matched=${it.catalogItemId}`);

      if (it.addAsPoOnly) {
        console.log(`[PO] Item ${i}: skipping (addAsPoOnly)`);
        continue;
      }

      if (it.status === 'matched' && it.catalogItemId) {
        catalogIds[i] = it.catalogItemId;
        console.log(`[PO] Item ${i}: reusing catalogId=${it.catalogItemId}`);
        continue;
      }

      const retailCents = it.retail_price != null ? Math.round(Number(it.retail_price) * 100) : 0;
      const idempotencyKey = randomUUID();
      const itemId = `#item-${idempotencyKey.slice(0, 8)}`;
      const varId = `#var-${idempotencyKey.slice(0, 8)}`;

      try {
        const categoryId = await resolveCategoryId(it.category ?? '');
        console.log(`[PO] Item ${i}: building upsert body (category=${categoryId ?? 'none'})`);

        const itemData: Record<string, unknown> = {
          name,
          ...(it.description?.trim() && { description: it.description.trim() }),
          ...(categoryId && { categories: [{ id: categoryId }] }),
          variations: [
            {
              type: 'ITEM_VARIATION',
              id: varId,
              item_variation_data: {
                name,
                pricing_type: 'FIXED_PRICING',
                track_inventory: true,
                ...(retailCents > 0 && {
                  price_money: { amount: retailCents, currency: 'AUD' },
                }),
                ...(it.sku?.trim() && { sku: it.sku.trim() }),
              },
            },
          ],
        };

        const upsertBody = {
          idempotency_key: idempotencyKey,
          object: {
            type: 'ITEM',
            id: itemId,
            item_data: itemData,
          },
        };
        const bodyStr = JSON.stringify(upsertBody);
        console.log(`[PO] Item ${i}: body stringified (${bodyStr.length} chars)`);

        console.log(`[PO] Item ${i}: calling ${squareBaseUrl}/v2/catalog/object`);
        const upsertRes = await fetch(`${squareBaseUrl}/v2/catalog/object`, {
          method: 'POST',
          headers: squareHeaders,
          body: bodyStr,
        });

        console.log(`[PO] Item ${i}: Square responded ${upsertRes.status}`);
        const upsertData = await upsertRes.json();
        if (!upsertRes.ok) {
          const errMsg = upsertData?.errors?.[0]?.detail || upsertData?.errors?.[0]?.code || JSON.stringify(upsertData);
          throw new Error(errMsg);
        }

        const catalogItemId = upsertData.catalog_object?.id;
        const variationId = upsertData.id_mappings?.find(
          (m: { client_object_id: string; object_id: string }) => m.client_object_id === varId
        )?.object_id;

        console.log(`[PO] Item ${i}: Item ID: ${catalogItemId}`);
        console.log(`[PO] Item ${i}: Variation ID: ${variationId}`);

        if (!variationId) {
          throw new Error('Missing variation_id from Square response');
        }

        if (catalogItemId) catalogIds[i] = catalogItemId;
        variationIds[i] = variationId;

        if (it.image?.startsWith('data:image/') && catalogItemId) {
          console.log(`[PO] Item ${i}: parsing image data URL (${it.image.length} chars)`);
          const parsed = parseDataUrl(it.image);
          if (parsed) {
            try {
              console.log(`[PO] Item ${i}: uploading image (${parsed.buffer.length} bytes)`);
              const imgIdempotencyKey = randomUUID();
              const imgRequest = {
                idempotency_key: imgIdempotencyKey,
                object_id: catalogItemId,
                is_primary: true,
                image: {
                  id: `#img-${idempotencyKey.slice(0, 8)}`,
                  type: 'IMAGE',
                  image_data: { name: name.slice(0, 100) },
                },
              };
              const formData = new FormData();
              formData.append('request', JSON.stringify(imgRequest));
              formData.append('image_file', new Blob([parsed.buffer], { type: parsed.mime }), `image.${parsed.ext}`);

              const imgRes = await fetch(`${squareBaseUrl}/v2/catalog/images`, {
                method: 'POST',
                headers: {
                  'Square-Version': squareHeaders['Square-Version'],
                  'Authorization': squareHeaders['Authorization'],
                },
                body: formData,
              });
              console.log(`[PO] Item ${i}: image upload responded ${imgRes.status}`);
            } catch (imgErr) {
              console.error(`[PO] Item ${i}: image upload failed:`, imgErr instanceof Error ? imgErr.message : imgErr);
            }
          }
        }
        // Link vendor to variation via a separate ITEM_VARIATION_VENDOR_INFO catalog object
        if (it.vendor_id && variationId) {
          try {
            const viKey = randomUUID();
            const vendorInfoBody = {
              idempotency_key: viKey,
              object: {
                type: 'ITEM_VARIATION_VENDOR_INFO',
                id: `#vi-${viKey.slice(0, 8)}`,
                item_variation_vendor_info_data: {
                  item_variation_id: variationId,
                  vendor_id: it.vendor_id,
                  ...(it.vendor_code?.trim() && { sku: it.vendor_code.trim() }),
                  ...(it.purchase_price != null && {
                    price_money: { amount: Math.round(Number(it.purchase_price) * 100), currency: 'AUD' },
                  }),
                },
              },
            };
            const viRes = await fetch(`${squareBaseUrl}/v2/catalog/object`, {
              method: 'POST',
              headers: squareHeaders,
              body: JSON.stringify(vendorInfoBody),
            });
            console.log(`[PO] Item ${i}: vendor info upsert responded ${viRes.status}`);
            if (!viRes.ok) {
              const viErr = await viRes.json();
              console.error(`[PO] Item ${i}: vendor info error:`, viErr?.errors?.[0]?.detail ?? JSON.stringify(viErr));
            }
          } catch (viErr) {
            console.error(`[PO] Item ${i}: vendor info failed:`, viErr instanceof Error ? viErr.message : viErr);
          }
        }

        // Set on-hand stock via Inventory API using initial_stock
        const stockQty = it.initial_stock != null ? Number(it.initial_stock) : 0;
        if (stockQty > 0 && locationId && variationId) {
          try {
            const invBody = {
              idempotency_key: randomUUID(),
              changes: [
                {
                  type: 'PHYSICAL_COUNT',
                  physical_count: {
                    catalog_object_id: variationId,
                    state: 'IN_STOCK',
                    location_id: locationId,
                    quantity: String(stockQty),
                    occurred_at: new Date().toISOString(),
                  },
                },
              ],
            };
            const invRes = await fetch(`${squareBaseUrl}/v2/inventory/changes/batch-create`, {
              method: 'POST',
              headers: squareHeaders,
              body: JSON.stringify(invBody),
            });
            console.log(`[PO] Item ${i}: inventory set responded ${invRes.status} (qty=${stockQty})`);
            if (!invRes.ok) {
              const invErr = await invRes.json();
              console.error(`[PO] Item ${i}: inventory error:`, invErr?.errors?.[0]?.detail ?? JSON.stringify(invErr));
            }
          } catch (invErr) {
            console.error(`[PO] Item ${i}: inventory failed:`, invErr instanceof Error ? invErr.message : invErr);
          }
        }

        console.log(`[PO] Item ${i}: done`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[PO] Item ${i} FAILED: ${message}`);
        return NextResponse.json(
          { error: `Failed to create item "${name}": ${message}` },
          { status: 502 }
        );
      }
    }

    console.log('[PO] All items processed, creating PO in DB...');
    const vendor = items[0]?.vendor?.trim() ?? '';
    const vendorCode = items[0]?.vendor_code?.trim() ?? '';
    const totalAmount = items.reduce(
      (sum, it) => sum + (it.purchase_price ?? 0) * it.quantity,
      0
    );

    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        invoice_id: invoiceId,
        user_id: userId,
        vendor,
        vendor_code: vendorCode,
        total_amount: totalAmount,
        status: 'created',
      })
      .select('id')
      .single();

    if (poError || !po?.id) {
      console.error('[PO] Failed to create PO:', poError?.message);
      return NextResponse.json(
        { error: poError?.message ?? 'Failed to create purchase order' },
        { status: 500 }
      );
    }
    console.log(`[PO] PO created: ${po.id}`);

    const invoiceItemIds: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.invoice_item_id) invoiceItemIds.push(it.invoice_item_id);
      const extraFields = buildExtraFields(it);
      console.log(`[PO] Inserting PO line ${i}: ${it.product_name}`);
      await supabase.from('purchase_order_lines').insert({
        purchase_order_id: po.id,
        product_name: it.product_name,
        sku: it.sku?.trim() || null,
        quantity: it.quantity,
        purchase_price: it.purchase_price,
        catalog_item_id: catalogIds[i] ?? null,
        sort_order: i,
        invoice_item_id: it.invoice_item_id ?? null,
        extra_fields: extraFields,
      });

      const resolvedItemId = catalogIds[i];
      const resolvedVariationId = variationIds[i];
      if (resolvedVariationId && (it.vendor?.trim() || it.vendor_code?.trim())) {
        console.log(`[PO] Upserting item_vendor: variation_id=${resolvedVariationId}, item_id=${resolvedItemId}`);
        await supabase.from('item_vendors').upsert(
          {
            variation_id: resolvedVariationId,
            item_id: resolvedItemId ?? null,
            vendor_id: it.vendor_id?.trim() || null,
            vendor_name: (it.vendor ?? '').trim() || '',
            vendor_code: (it.vendor_code ?? '').trim() || '',
          },
          { onConflict: 'variation_id' }
        );
      }
    }

    if (invoiceItemIds.length > 0) {
      console.log(`[PO] Marking ${invoiceItemIds.length} invoice items as in_purchase_order`);
      await supabase
        .from('invoice_items')
        .update({ in_purchase_order: true })
        .in('id', invoiceItemIds);
    }

    console.log('[PO] === SUCCESS ===');
    return NextResponse.json({
      success: true,
      purchaseOrderId: po.id,
      message: 'Purchase order created',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('[PO] === OUTER CATCH ===', message);
    if (stack) console.error('[PO] Stack:', stack);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
