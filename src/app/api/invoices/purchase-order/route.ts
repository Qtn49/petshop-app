import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { getSquareEnvironment } from '@/lib/integrations/square/squareOAuth';
import { randomUUID } from 'crypto';
import type { ConfirmItem } from '@/lib/invoice-import/confirm-types';
import { getMissingFields } from '@/lib/invoice-import/confirm-types';

type Body = {
  userId: string;
  invoiceId: string;
  items: ConfirmItem[];
  /** Optional PO-level fields (from invoice parsing or user). Used in CSV. */
  poVendorName?: string;
  poShipTo?: string;
  poExpectedOn?: string;
  poNotes?: string;
};

const IS_DEV = process.env.NODE_ENV !== 'production';
const log = (...args: unknown[]) => { if (IS_DEV) console.log(...args); };

/** Escape a CSV field (quote if needed). */
function csvEscape(val: string): string {
  const s = String(val ?? '');
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build CSV content matching template: Vendor, Ship to, Expected On, Notes, then line items (Item Name, Variation Name, SKU, GTIN, Vendor Code, Notes, Qty, Unit Cost). */
function buildPurchaseOrderCsv(
  items: ConfirmItem[],
  opts?: { vendorName?: string; shipTo?: string; expectedOn?: string; notes?: string }
): string {
  const vendorName = opts?.vendorName?.trim() ?? items[0]?.vendor?.trim() ?? '';
  const shipTo = opts?.shipTo?.trim() ?? '';
  const expectedOn = opts?.expectedOn?.trim() || new Date().toISOString().slice(0, 10);
  const notes = opts?.notes?.trim() ?? '';
  const rows: string[] = [
    [csvEscape('Vendor'), csvEscape(vendorName)].join(','),
    [csvEscape('Ship to'), csvEscape(shipTo)].join(','),
    [csvEscape('Expected On'), csvEscape(expectedOn)].join(','),
    [csvEscape('Notes'), csvEscape(notes)].join(','),
    '',
    [csvEscape('Item Name'), csvEscape('Variation Name'), csvEscape('SKU'), csvEscape('GTIN'), csvEscape('Vendor Code'), csvEscape('Notes'), csvEscape('Qty'), csvEscape('Unit Cost')].join(','),
  ];
  for (const it of items) {
    const itemName = (it.product_name ?? '').trim();
    const variationName = itemName;
    const sku = (it.sku ?? '').trim();
    const gtin = (it.gtin ?? '').trim();
    const vendorCode = (it.vendor_code ?? '').trim();
    const notes = (it.description ?? '').trim();
    const qty = String(it.quantity ?? 0);
    const unitCost = it.purchase_price != null ? String(Number(it.purchase_price)) : '';
    rows.push([csvEscape(itemName), csvEscape(variationName), csvEscape(sku), csvEscape(gtin), csvEscape(vendorCode), csvEscape(notes), csvEscape(qty), csvEscape(unitCost)].join(','));
  }
  return rows.join('\r\n');
}

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
  log('[PO] === START ===');
  try {
    log('[PO] Parsing request body...');
    const body = (await request.json()) as Body;
    const { userId, invoiceId, items } = body;
    log(`[PO] userId=${userId}, invoiceId=${invoiceId}, items=${items?.length}`);

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
    log('[PO] Validation passed');

    const supabase = getSupabaseClient();

    log('[PO] Fetching invoice...');
    let inv:
      | {
          id: string;
          user_id: string;
          po_vendor_name?: string | null;
          po_ship_to?: string | null;
          po_expected_on?: string | null;
          po_notes?: string | null;
        }
      | null = null;

    const fetchInvoice = async (
      where: { col: 'id' | 'invoice_id'; val: string }
    ): Promise<typeof inv> => {
      // Some environments may not have PO columns migrated yet; select only what exists.
      const trySelect = async (select: string): Promise<{ data: unknown; error: unknown }> => {
        const { data, error } = await supabase
          .from('invoices')
          .select(select)
          .eq(where.col, where.val)
          .single();
        return { data, error };
      };

      // First attempt with PO columns (most complete)
      const full = await trySelect('id, user_id, po_vendor_name, po_ship_to, po_expected_on, po_notes');
      if (!full.error) return full.data as typeof inv;

      // Fallback if PO columns aren't present yet
      const fullErrMsg = full.error && typeof (full as any).error === 'object' && 'message' in (full as any).error
        ? String((full as any).error.message)
        : String(full.error);
      if (/po_vendor_name|po_ship_to|po_expected_on|po_notes/i.test(fullErrMsg)) {
        log('[PO] Invoice PO-columns missing; retrying select without PO columns', {
          invoiceId,
          userId,
          missingColumnsError: fullErrMsg,
        });
        const minimal = await trySelect('id, user_id');
        return (minimal.data as typeof inv) ?? null;
      }

      // Unknown error: return null to let caller handle as "not found"
      log('[PO] Invoice lookup error', {
        invoiceId,
        userId,
        where,
        error: fullErrMsg,
      });
      return null;
    };

    inv = await fetchInvoice({ col: 'id', val: invoiceId });

    if (!inv) {
      const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
      log('[PO] Invoice not found in DB', {
        invoiceId,
        userId,
        hasServiceRole,
        env: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'has_supabase_url' : 'missing_supabase_url',
      });

      // Fallback: some older schemas used `invoice_id` instead of `id`
      inv = await fetchInvoice({ col: 'invoice_id', val: invoiceId });
    }

    if (!inv) {
      return NextResponse.json(
        { error: 'Invoice not found', reason: 'missing_invoice', invoiceId },
        { status: 404 }
      );
    }

    const isOwner = inv.user_id === userId;
    log('[PO] Invoice found', { invoiceId, invUserId: inv.user_id, requesterUserId: userId, isOwner });
    if (!isOwner) {
      const { data: cu } = await supabase.from('users').select('organization_id').eq('id', userId).single();
      const { data: ou } = await supabase.from('users').select('organization_id').eq('id', inv.user_id).single();
      const sameOrg = cu?.organization_id && ou?.organization_id && cu.organization_id === ou.organization_id;
      log('[PO] Invoice org check', {
        requesterOrg: cu?.organization_id,
        ownerOrg: ou?.organization_id,
        sameOrg,
      });
      if (!sameOrg) {
        return NextResponse.json(
          { error: 'Invoice not found', reason: 'different_organization', invoiceId },
          { status: 404 }
        );
      }
    }
    log('[PO] Invoice found');

    const allItemsHaveSku = items.every(
      (it) => it.addAsPoOnly || (it.status === 'matched' && it.catalogItemId)
    );
    log(`[PO] All items have SKU (skip Square): ${allItemsHaveSku}`);

    let locationId: string | null = null;
    const squareEnv = getSquareEnvironment();
    const squareBaseUrl = squareEnv === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';
    let squareHeaders: { 'Square-Version': string; 'Authorization': string; 'Content-Type': string } | null = null;

    if (!allItemsHaveSku) {
      log('[PO] Fetching Square connection...');
      const { data: conn } = await supabase
        .from('square_connections')
        .select('access_token, location_id')
        .eq('user_id', userId)
        .single();

      if (!conn?.access_token) {
        return NextResponse.json({ error: 'Square not connected' }, { status: 401 });
      }
      locationId = conn.location_id ?? null;
      log(`[PO] Square connected (location=${locationId ?? 'none'})`);
      squareHeaders = {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${conn.access_token}`,
        'Content-Type': 'application/json',
      };
    }

    const categoryNameToId = new Map<string, string>();
    if (!allItemsHaveSku && squareHeaders) {
      log('[PO] Fetching Square categories...');
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
        log(`[PO] Loaded ${categoryNameToId.size} categories`);
      } catch (catErr) {
        console.error('[PO] Failed to load categories:', catErr instanceof Error ? catErr.message : catErr);
      }
    }

    type SquareHeaders = { 'Square-Version': string; 'Authorization': string; 'Content-Type': string };
    const resolveCategoryId = async (categoryName: string, h: SquareHeaders): Promise<string | null> => {
      if (!categoryName.trim()) return null;
      const existing = categoryNameToId.get(categoryName.trim().toLowerCase());
      if (existing) return existing;

      // Create the category
      try {
        log(`[PO] Creating category "${categoryName}"`);
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
          headers: h,
          body: JSON.stringify(catBody),
        });
        const data = await res.json();
        const catId = data.catalog_object?.id;
        if (catId) {
          categoryNameToId.set(categoryName.trim().toLowerCase(), catId);
          log(`[PO] Created category "${categoryName}" → ${catId}`);
          return catId;
        }
      } catch (e) {
        console.error(`[PO] Failed to create category "${categoryName}":`, e instanceof Error ? e.message : e);
      }
      return null;
    }

    const catalogIds: Record<number, string> = {};
    const variationIds: Record<number, string> = {};

    if (allItemsHaveSku) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.status === 'matched' && it.catalogItemId) catalogIds[i] = it.catalogItemId;
      }
    } else {
      const sqHeaders = squareHeaders!;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const name = (it.product_name ?? '').trim();
      log(`[PO] Item ${i}: "${name}" status=${it.status} addAsPoOnly=${it.addAsPoOnly} matched=${it.catalogItemId}`);

      if (it.addAsPoOnly) {
        log(`[PO] Item ${i}: skipping (addAsPoOnly)`);
        continue;
      }

      if (it.status === 'matched' && it.catalogItemId) {
        catalogIds[i] = it.catalogItemId;
        log(`[PO] Item ${i}: reusing catalogId=${it.catalogItemId}`);
        continue;
      }

      const retailCents = it.retail_price != null ? Math.round(Number(it.retail_price) * 100) : 0;
      const idempotencyKey = randomUUID();
      const itemId = `#item-${idempotencyKey.slice(0, 8)}`;
      const varId = `#var-${idempotencyKey.slice(0, 8)}`;

      try {
        const categoryId = await resolveCategoryId(it.category ?? '', sqHeaders);
        log(`[PO] Item ${i}: building upsert body (category=${categoryId ?? 'none'})`);

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
        log(`[PO] Item ${i}: body stringified (${bodyStr.length} chars)`);

        log(`[PO] Item ${i}: calling ${squareBaseUrl}/v2/catalog/object`);
        const upsertRes = await fetch(`${squareBaseUrl}/v2/catalog/object`, {
          method: 'POST',
          headers: sqHeaders,
          body: bodyStr,
        });

        log(`[PO] Item ${i}: Square responded ${upsertRes.status}`);
        const upsertData = await upsertRes.json();
        if (!upsertRes.ok) {
          const errMsg = upsertData?.errors?.[0]?.detail || upsertData?.errors?.[0]?.code || JSON.stringify(upsertData);
          throw new Error(errMsg);
        }

        const catalogItemId = upsertData.catalog_object?.id;
        const variationId = upsertData.id_mappings?.find(
          (m: { client_object_id: string; object_id: string }) => m.client_object_id === varId
        )?.object_id;

        log(`[PO] Item ${i}: Item ID: ${catalogItemId}`);
        log(`[PO] Item ${i}: Variation ID: ${variationId}`);

        if (!variationId) {
          throw new Error('Missing variation_id from Square response');
        }

        if (catalogItemId) catalogIds[i] = catalogItemId;
        variationIds[i] = variationId;

        if (it.image?.startsWith('data:image/') && catalogItemId) {
          log(`[PO] Item ${i}: parsing image data URL (${it.image.length} chars)`);
          const parsed = parseDataUrl(it.image);
          if (parsed) {
            try {
              log(`[PO] Item ${i}: uploading image (${parsed.buffer.length} bytes)`);
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
              formData.append('image_file', new Blob([new Uint8Array(parsed.buffer)], { type: parsed.mime }), `image.${parsed.ext}`);

              const imgRes = await fetch(`${squareBaseUrl}/v2/catalog/images`, {
                method: 'POST',
                headers: {
                  'Square-Version': sqHeaders['Square-Version'],
                  'Authorization': sqHeaders['Authorization'],
                },
                body: formData,
              });
              log(`[PO] Item ${i}: image upload responded ${imgRes.status}`);
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
              headers: sqHeaders,
              body: JSON.stringify(vendorInfoBody),
            });
            log(`[PO] Item ${i}: vendor info upsert responded ${viRes.status}`);
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
              headers: sqHeaders,
              body: JSON.stringify(invBody),
            });
            log(`[PO] Item ${i}: inventory set responded ${invRes.status} (qty=${stockQty})`);
            if (!invRes.ok) {
              const invErr = await invRes.json();
              console.error(`[PO] Item ${i}: inventory error:`, invErr?.errors?.[0]?.detail ?? JSON.stringify(invErr));
            }
          } catch (invErr) {
            console.error(`[PO] Item ${i}: inventory failed:`, invErr instanceof Error ? invErr.message : invErr);
          }
        }

        log(`[PO] Item ${i}: done`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[PO] Item ${i} FAILED: ${message}`);
        return NextResponse.json(
          { error: `Failed to create item "${name}": ${message}` },
          { status: 502 }
        );
      }
    }
    }

    log('[PO] All items processed, creating PO in DB...');
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
    log(`[PO] PO created: ${po.id}`);

    const invoiceItemIds: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.invoice_item_id) invoiceItemIds.push(it.invoice_item_id);
      const extraFields = buildExtraFields(it);
      log(`[PO] Inserting PO line ${i}: ${it.product_name}`);
      const { error: lineErr } = await supabase.from('purchase_order_lines').insert({
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
      if (lineErr) console.error(`[PO] PO line ${i} insert FAILED:`, lineErr.message);

      const resolvedItemId = catalogIds[i];
      const resolvedVariationId = variationIds[i];
      if (resolvedVariationId && (it.vendor?.trim() || it.vendor_code?.trim())) {
        log(`[PO] Upserting item_vendor: variation_id=${resolvedVariationId}, item_id=${resolvedItemId}`);
        const { error: vendorErr } = await supabase.from('item_vendors').upsert(
          {
            variation_id: resolvedVariationId,
            item_id: resolvedItemId ?? null,
            vendor_id: it.vendor_id?.trim() || null,
            vendor_name: (it.vendor ?? '').trim() || '',
            vendor_code: (it.vendor_code ?? '').trim() || '',
          },
          { onConflict: 'variation_id' }
        );
        if (vendorErr) console.error(`[PO] item_vendor upsert FAILED:`, vendorErr.message);
      }
    }

    if (invoiceItemIds.length > 0) {
      log(`[PO] Marking ${invoiceItemIds.length} invoice items as in_purchase_order`);
      const { error: markErr } = await supabase
        .from('invoice_items')
        .update({ in_purchase_order: true })
        .in('id', invoiceItemIds);
      if (markErr) console.error(`[PO] Marking in_purchase_order FAILED:`, markErr.message);
    }

    const invMeta = inv as { po_vendor_name?: string; po_ship_to?: string; po_expected_on?: string; po_notes?: string };
    const csvContent = buildPurchaseOrderCsv(items, {
      vendorName: invMeta.po_vendor_name ?? body.poVendorName,
      shipTo: invMeta.po_ship_to ?? body.poShipTo,
      expectedOn: invMeta.po_expected_on ?? body.poExpectedOn,
      notes: invMeta.po_notes ?? body.poNotes,
    });
    const csvFilename = `purchase_order_${invoiceId}_${po.id}.csv`;
    const csvBase64 = Buffer.from(csvContent, 'utf-8').toString('base64');

    // Mark the invoice as completed
    try {
      await supabase.from('invoices').update({ status: 'completed' }).eq('id', invoiceId);
      log('[PO] Invoice marked as completed');
    } catch (markErr) {
      console.error('[PO] Failed to mark invoice as completed:', markErr instanceof Error ? markErr.message : markErr);
    }

    log('[PO] === SUCCESS ===');
    return NextResponse.json({
      success: true,
      purchaseOrderId: po.id,
      message: 'Purchase order created',
      csvBase64,
      csvFilename,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('[PO] === OUTER CATCH ===', message);
    if (stack) console.error('[PO] Stack:', stack);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
