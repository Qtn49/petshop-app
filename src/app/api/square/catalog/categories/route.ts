import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { getSquareEnvironment } from '@/lib/integrations/square/squareOAuth';
import { Client, Environment } from 'square';

/**
 * GET /api/square/catalog/categories?userId=...
 * Returns category names from the Square catalog (for dropdown/autocomplete).
 */
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

  const names: string[] = [];
  let cursor: string | undefined;

  try {
    do {
      const { result } = await client.catalogApi.listCatalog(cursor, 'CATEGORY');
      const objects = result.objects ?? [];
      for (const obj of objects) {
        const name = obj.categoryData?.name?.trim();
        if (name && !names.includes(name)) names.push(name);
      }
      cursor = result.cursor ?? undefined;
    } while (cursor);

    names.sort((a, b) => a.localeCompare(b));
    return NextResponse.json({ categories: names });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}
