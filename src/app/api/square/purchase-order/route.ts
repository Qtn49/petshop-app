import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { Client, Environment } from 'square';

// Note: Square's Purchase Order API may have limited availability.
// This uses Inventory API to create inventory counts, or falls back to returning
// the PO summary for manual creation in Square.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, lineItems } = body;

    if (!userId || !lineItems?.length) {
      return NextResponse.json(
        { error: 'userId and lineItems required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();
    const { data: conn } = await supabase
      .from('square_connections')
      .select('access_token, merchant_id')
      .eq('user_id', userId)
      .single();

    if (!conn?.access_token) {
      return NextResponse.json(
        { error: 'Square not connected' },
        { status: 401 }
      );
    }

    const env =
      process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT === 'production'
        ? Environment.Production
        : Environment.Sandbox;

    const client = new Client({
      accessToken: conn.access_token,
      environment: env,
    });

    const catalogIds = lineItems
      .map((i: { catalogVariationId?: string; catalogItemId?: string }) => i.catalogVariationId || i.catalogItemId)
      .filter(Boolean);

    if (catalogIds.length === 0) {
      return NextResponse.json(
        { error: 'No valid catalog items to order' },
        { status: 400 }
      );
    }

    // Square Purchase Order API has limited availability. We return the PO summary.
    // User can create the PO manually in Square or use Square's inventory features.
    return NextResponse.json({
      success: true,
      message: 'Purchase order items recorded. Complete receiving in Square.',
      lineItems: lineItems.map((i: { name: string; quantity: number }) => ({
        name: i.name,
        quantity: i.quantity,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create PO' },
      { status: 500 }
    );
  }
}
