/**
 * Fetch Square orders for sales data. Used by chat API when user asks about sales/revenue.
 */
import { getSupabaseClient } from '@/lib/supabase-server';
import { getSquareEnvironment } from '@/lib/integrations/square/squareOAuth';
import { Client, Environment } from 'square';

export type OrdersAggregate = {
  totalRevenueCents: number;
  orderCount: number;
  topByQuantity: { name: string; quantity: number }[];
  topByRevenue: { name: string; revenueCents: number }[];
};

export async function fetchSquareOrdersForUser(
  userId: string
): Promise<OrdersAggregate | { error: string }> {
  const supabase = getSupabaseClient();
  const { data: conn } = await supabase
    .from('square_connections')
    .select('access_token, location_id')
    .eq('user_id', userId)
    .single();

  if (!conn?.access_token) {
    return { error: 'Square not connected' };
  }

  if (!conn.location_id) {
    return { error: 'No Square location configured' };
  }

  const squareEnv = getSquareEnvironment();
  const env = squareEnv === 'production' ? Environment.Production : Environment.Sandbox;

  const client = new Client({
    accessToken: conn.access_token,
    environment: env,
  });

  try {
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = new Date().toISOString();

    const { result } = await client.ordersApi.searchOrders({
      locationIds: [conn.location_id],
      query: {
        filter: {
          dateTimeFilter: {
            createdAt: {
              startAt: startDate,
              endAt: endDate,
            },
          },
        },
        sort: {
          sortField: 'CREATED_AT',
          sortOrder: 'DESC',
        },
      },
      limit: 50,
    });

    const orders = result.orders ?? [];
    let totalRevenueCents = 0;
    const qtyByProduct = new Map<string, number>();
    const revenueByProduct = new Map<string, number>();

    for (const order of orders) {
      const netCents = order.netAmounts?.totalMoney?.amount
        ? Number(order.netAmounts.totalMoney.amount)
        : 0;
      totalRevenueCents += netCents;

      for (const item of order.lineItems ?? []) {
        const name = item.name ?? 'Unknown';
        const qty = Math.max(0, Number(item.quantity ?? 1) || 1);
        const itemPrice = item.basePriceMoney?.amount
          ? Number(item.basePriceMoney.amount)
          : 0;
        const lineTotal = itemPrice * qty;

        qtyByProduct.set(name, (qtyByProduct.get(name) ?? 0) + qty);
        revenueByProduct.set(name, (revenueByProduct.get(name) ?? 0) + lineTotal);
      }
    }

    const topByQuantity = Array.from(qtyByProduct.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, quantity]) => ({ name, quantity }));

    const topByRevenue = Array.from(revenueByProduct.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, revenueCents]) => ({ name, revenueCents }));

    return {
      totalRevenueCents,
      orderCount: orders.length,
      topByQuantity,
      topByRevenue,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to fetch orders',
    };
  }
}
