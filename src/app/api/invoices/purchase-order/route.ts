import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { getSquareEnvironment } from '@/lib/integrations/square/squareOAuth';
import { Client, Environment, FileWrapper } from 'square';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import type { ConfirmItem } from '@/lib/invoice-import/confirm-types';
import { getMissingFields } from '@/lib/invoice-import/confirm-types';

type Body = { userId: string; invoiceId: string; items: ConfirmItem[] };

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

    const { data: invoice } = await supabase
      .from('invoices')
      .select('id')
      .eq('id', invoiceId)
      .eq('user_id', userId)
      .single();

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
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

      try {
        const { result } = await client.catalogApi.upsertCatalogObject({
          idempotencyKey,
          object: {
            type: 'ITEM',
            id: itemId,
            itemData: {
              name,
              ...(it.sku?.trim() && { sku: it.sku.trim() }),
              variations: [
                {
                  type: 'ITEM_VARIATION',
                  id: varId,
                  itemVariationData: {
                    name: 'Default',
                    ...(retailCents > 0 && {
                      priceMoney: { amount: BigInt(retailCents), currency: 'AUD' as const },
                    }),
                  },
                },
              ],
            },
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
      await supabase.from('purchase_order_lines').insert({
        purchase_order_id: po.id,
        product_name: it.product_name,
        sku: it.sku?.trim() || null,
        quantity: it.quantity,
        purchase_price: it.purchase_price,
        catalog_item_id: catalogIds[i] ?? null,
        sort_order: i,
        invoice_item_id: it.invoice_item_id ?? null,
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
