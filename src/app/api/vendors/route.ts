import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { getSquareEnvironment } from '@/lib/integrations/square/squareOAuth';
import { Client, Environment } from 'square';

/**
 * GET /api/vendors?userId=...
 * Returns Square vendors for autocomplete. Requires Square connection with VENDOR_READ.
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

  const vendors: { id: string; name: string }[] = [];
  let cursor: string | undefined;

  try {
    do {
      // Square returns 400 with empty body or sort-only; use filter for initial request.
      const body = cursor
        ? { cursor }
        : { filter: { status: ['ACTIVE'] }, sort: { field: 'CREATED_AT', order: 'ASC' as const } };
      const { result } = await client.vendorsApi.searchVendors(body);
      const list = result.vendors ?? [];
      for (const v of list) {
        const id = v.id?.trim();
        const name = (v.name ?? '').trim();
        if (id && name) vendors.push({ id, name });
      }
      cursor = result.cursor ?? undefined;
    } while (cursor);

    vendors.sort((a, b) => a.name.localeCompare(b.name));
    console.log('Vendors from Square:', JSON.stringify(vendors, null, 2));
    return NextResponse.json({ vendors });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const statusCode = (err as { statusCode?: number }).statusCode;
    const body = (err as { body?: unknown }).body;
    console.error('GET /api/vendors failed:', message, statusCode, body ?? '');
    if (statusCode === 403 || /permission|forbidden|VENDOR/i.test(message)) {
      return NextResponse.json(
        { error: 'Vendor access not granted. Disconnect and reconnect Square in Settings to add VENDOR_READ.', vendors: [] },
        { status: 200 }
      );
    }
    return NextResponse.json(
      { vendors: [], _error: message },
      { status: 200 }
    );
  }
}
