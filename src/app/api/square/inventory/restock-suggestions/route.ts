import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { getSquareEnvironment } from '@/lib/integrations/square/squareOAuth';

type RestockItem = {
  variationId: string;
  itemName: string;
  currentQty: number;
  minQty: number;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    const supabase = getSupabaseClient();

    // Fetch org restock settings
    const { data: user } = await supabase.from('users').select('organization_id').eq('id', userId).single();
    if (!user?.organization_id) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { data: org } = await supabase
      .from('organization')
      .select('restock_settings')
      .eq('id', user.organization_id)
      .single();

    const restockSettings = org?.restock_settings as {
      min_stock_threshold?: number;
      auto_check_on_login?: boolean;
      category_thresholds?: Record<string, number>;
    } | null;

    if (!restockSettings?.auto_check_on_login) {
      return NextResponse.json({ items: [], autoCheckEnabled: false, squareConnected: false });
    }

    const minThreshold = restockSettings.min_stock_threshold ?? 5;

    // Fetch Square connection
    const { data: conn } = await supabase
      .from('square_connections')
      .select('access_token, location_id')
      .eq('user_id', userId)
      .single();

    if (!conn?.access_token) {
      return NextResponse.json({ items: [], autoCheckEnabled: true, squareConnected: false });
    }

    const squareEnv = getSquareEnvironment();
    const baseUrl = squareEnv === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';

    const headers = {
      Authorization: `Bearer ${conn.access_token}`,
      'Square-Version': '2024-01-17',
      'Content-Type': 'application/json',
    };

    // Fetch inventory counts
    const locationId = conn.location_id;
    const invUrl = locationId
      ? `${baseUrl}/v2/inventory/counts?location_ids=${locationId}`
      : `${baseUrl}/v2/inventory/counts`;

    const invRes = await fetch(invUrl, { headers });
    if (!invRes.ok) {
      return NextResponse.json({ items: [], autoCheckEnabled: true, squareConnected: true, error: 'Failed to fetch inventory' });
    }

    const invData = await invRes.json();
    const counts: Array<{ catalog_object_id?: string; quantity?: string; state?: string }> = invData.counts ?? [];

    // Filter IN_STOCK below threshold
    const belowThreshold = counts.filter((c) => {
      if (c.state !== 'IN_STOCK') return false;
      const qty = parseFloat(c.quantity ?? '0');
      return qty < minThreshold;
    });

    if (belowThreshold.length === 0) {
      return NextResponse.json({ items: [], autoCheckEnabled: true, squareConnected: true });
    }

    // Batch retrieve catalog items to get names
    const variationIds = belowThreshold
      .map((c) => c.catalog_object_id)
      .filter(Boolean) as string[];

    const batchRes = await fetch(`${baseUrl}/v2/catalog/batch-retrieve`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ object_ids: variationIds.slice(0, 100) }),
    });

    const variationNameMap = new Map<string, string>();
    if (batchRes.ok) {
      const batchData = await batchRes.json();
      const objects: Array<{
        id?: string;
        item_variation_data?: { name?: string; item_id?: string };
        item_data?: { name?: string };
      }> = batchData.objects ?? [];

      // Get parent item names
      const parentIds = objects
        .map((o) => o.item_variation_data?.item_id)
        .filter(Boolean) as string[];

      const parentNames = new Map<string, string>();
      if (parentIds.length > 0) {
        const parentRes = await fetch(`${baseUrl}/v2/catalog/batch-retrieve`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ object_ids: Array.from(new Set(parentIds)).slice(0, 100) }),
        });
        if (parentRes.ok) {
          const parentData = await parentRes.json();
          for (const obj of parentData.objects ?? []) {
            if (obj.id && obj.item_data?.name) {
              parentNames.set(obj.id, obj.item_data.name);
            }
          }
        }
      }

      for (const obj of objects) {
        if (!obj.id) continue;
        const parentId = obj.item_variation_data?.item_id;
        const parentName = parentId ? parentNames.get(parentId) : undefined;
        const varName = obj.item_variation_data?.name;
        const displayName = parentName
          ? varName && varName !== 'Default' ? `${parentName} - ${varName}` : parentName
          : varName ?? obj.id;
        variationNameMap.set(obj.id, displayName);
      }
    }

    const items: RestockItem[] = belowThreshold.map((c) => ({
      variationId: c.catalog_object_id ?? '',
      itemName: variationNameMap.get(c.catalog_object_id ?? '') ?? `Item ${c.catalog_object_id}`,
      currentQty: parseFloat(c.quantity ?? '0'),
      minQty: minThreshold,
    }));

    return NextResponse.json({ items, autoCheckEnabled: true, squareConnected: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
