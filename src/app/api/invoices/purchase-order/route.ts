import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { getSquareEnvironment } from '@/lib/integrations/square/squareOAuth';
import { Client, Environment, FileWrapper } from 'square';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
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
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1];
  const base64 = match[2];
  const buffer = Buffer.from(base64, 'base64');
  const ext = mime === 'image/png' ? 'png' : mime === 'image/gif' ? 'gif' : 'jpg';
  return { buffer, mime, ext };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const { userId, invoiceId, items } = body;

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

    const supabase = getSupabaseClient();

    const { data: inv } = await supabase.from('invoices').select('id, user_id').eq('id', invoiceId).single();
    if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    const isOwner = inv.user_id === userId;
    if (!isOwner) {
      const { data: cu } = await supabase.from('users').select('organization_id').eq('id', userId).single();
      const { data: ou } = await supabase.from('users').select('organization_id').eq('id', inv.user_id).single();
      const sameOrg = cu?.organization_id && ou?.organization_id && cu.organization_id === ou.organization_id;
      if (!sameOrg) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const { data: conn } = await supabase
      .from('square_connections')
      .select('access_token')
      .eq('user_id', userId)
      .single();

    if (!conn?.access_token) {
      return NextResponse.json({ error: 'Square not connected' }, { status: 401 });
    }

    const squareEnv = getSquareEnvironment();
    const env = squareEnv === 'production' ? Environment.Production : Environment.Sandbox;
    const client = new Client({
      accessToken: conn.access_token,
      environment: env,
    });

    const catalogIds: Record<number, string> = {};

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const name = (it.product_name ?? '').trim();
      const retailCents = it.retail_price != null ? Math.round(Number(it.retail_price) * 100) : 0;
      const idempotencyKey = randomUUID();
      const itemId = `#item-${idempotencyKey.slice(0, 8)}`;
      const varId = `#var-${idempotencyKey.slice(0, 8)}`;

      if (it.status === 'matched' && it.catalogItemId) {
        catalogIds[i] = it.catalogItemId;
        continue;
      }

      const extraFields = buildExtraFields(it);
      if (typeof console !== 'undefined' && console.log) {
        console.log('Building Square payload from:', { name, sku: it.sku, retailCents, extraFields });
      }

      const customAttrValues: Record<string, { stringValue?: string }> = {};
      if (it.customAttributes) {
        for (const [key, val] of Object.entries(it.customAttributes)) {
          if (val == null || String(val).trim() === '') continue;
          customAttrValues[key] = { stringValue: String(val).trim() };
        }
      }

      try {
        const itemData: Record<string, unknown> = {
          name,
          ...(it.sku?.trim() && { sku: it.sku.trim() }),
          ...(it.description?.trim() && { description: it.description.trim() }),
          variations: [
            {
              type: 'ITEM_VARIATION',
              id: varId,
              itemVariationData: {
                name: 'Default',
                ...(retailCents > 0 && {
                  priceMoney: { amount: BigInt(retailCents), currency: 'AUD' as const },
                }),
                ...(Object.keys(customAttrValues).length > 0 && { customAttributeValues: customAttrValues }),
              },
            },
          ],
        };

        const { result } = await client.catalogApi.upsertCatalogObject({
          idempotencyKey,
          object: {
            type: 'ITEM',
            id: itemId,
            itemData,
          },
        });

        const catalogId = result.catalogObject?.id ?? result.idMappings?.[0]?.objectId ?? '';
        if (catalogId) catalogIds[i] = catalogId;

        if (it.image?.startsWith('data:image/')) {
          const parsed = parseDataUrl(it.image);
          if (parsed) {
            try {
              const stream = Readable.from(parsed.buffer);
              const fileWrapper = new FileWrapper(stream, {
                filename: `image.${parsed.ext}`,
                contentType: parsed.mime,
              });
              await client.catalogApi.createCatalogImage(
                {
                  idempotencyKey: randomUUID(),
                  objectId: catalogId,
                  isPrimary: true,
                  image: {
                    id: `#img-${idempotencyKey.slice(0, 8)}`,
                    type: 'IMAGE',
                    imageData: { name: name.slice(0, 100) },
                  },
                },
                fileWrapper
              );
            } catch {
              // Non-fatal: item created, image upload failed
            }
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          { error: `Failed to create item "${name}": ${message}` },
          { status: 502 }
        );
      }
    }

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
      return NextResponse.json(
        { error: poError?.message ?? 'Failed to create purchase order' },
        { status: 500 }
      );
    }

    const invoiceItemIds: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.invoice_item_id) invoiceItemIds.push(it.invoice_item_id);
      const extraFields = buildExtraFields(it, enabledFields);
      if (typeof console !== 'undefined' && console.log) {
        console.log('Persisting purchase order line extra_fields:', extraFields);
      }
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
    }

    if (invoiceItemIds.length > 0) {
      await supabase
        .from('invoice_items')
        .update({ in_purchase_order: true })
        .in('id', invoiceItemIds);
    }

    return NextResponse.json({
      success: true,
      purchaseOrderId: po.id,
      message: 'Purchase order created',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
