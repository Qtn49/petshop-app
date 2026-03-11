import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { getSquareEnvironment } from '@/lib/integrations/square/squareOAuth';
import { Client, Environment } from 'square';

export async function GET(request: Request) {
  const supabase = getSupabaseClient();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const { data: conn } = await supabase
    .from('square_connections')
    .select('access_token')
    .eq('user_id', userId)
    .single();

  if (!conn?.access_token) {
    return NextResponse.json(
      { error: 'Square not connected. Please connect your Square account.' },
      { status: 401 }
    );
  }

  const squareEnv = getSquareEnvironment();
  const env = squareEnv === 'production' ? Environment.Production : Environment.Sandbox;

  const client = new Client({
    accessToken: conn.access_token,
    environment: env,
  });

  try {
    const { result } = await client.catalogApi.listCatalog(
      undefined,
      'ITEM'
    );

    const items =
      result.objects?.map((obj) => ({
        id: obj.id,
        name: obj.itemData?.name,
        variations: obj.itemData?.variations?.map((v) => ({
          id: v.id,
          name: v.itemVariationData?.name,
        })),
      })) || [];

    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch catalog' },
      { status: 500 }
    );
  }
}
