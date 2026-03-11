import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { getSquareEnvironment } from '@/lib/integrations/square/squareOAuth';
import { Client, Environment } from 'square';
import { randomUUID } from 'crypto';

type CreateItem = { product_name: string; quantity?: number; price?: number };

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

    const created: { name: string; id?: string }[] = [];
    const errors: { name: string; error: string }[] = [];

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const name = (it.product_name ?? '').trim();
      if (!name) continue;

      const priceCents = it.price != null ? Math.round(Number(it.price) * 100) : 0;
      const idempotencyKey = randomUUID();
      const itemId = `#item-${idempotencyKey.slice(0, 8)}`;
      const varId = `#var-${idempotencyKey.slice(0, 8)}`;

      try {
        const { result } = await client.catalogApi.upsertCatalogObject({
          idempotencyKey,
          object: {
            type: 'ITEM',
            id: itemId,
            itemData: {
              name,
              variations: [
                {
                  type: 'ITEM_VARIATION',
                  id: varId,
                  itemVariationData: {
                    name: 'Default',
                    ...(priceCents > 0 && {
                      priceMoney: { amount: BigInt(priceCents), currency: 'AUD' as const },
                    }),
                  },
                },
              ],
            },
          },
        });

        const catalogId = result.catalogObject?.id ?? result.idMappings?.[0]?.objectId;
        created.push({ name, id: catalogId });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const statusCode = typeof (err as { statusCode?: number }).statusCode === 'number' ? (err as { statusCode: number }).statusCode : null;

        if (statusCode === 403 || /403|forbidden/i.test(message)) {
          const hint = 'Disconnect Square in Settings, then connect again to grant catalog write permission (ITEMS_WRITE).';
          errors.push({ name, error: `Permission denied (403). ${hint}` });
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
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
