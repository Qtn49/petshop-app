import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { getSquareEnvironment } from '@/lib/integrations/square/squareOAuth';
import { OPTIONAL_FIELDS_DEFAULT_VALUES } from '@/lib/invoice-import/confirm-types';
import { Client, Environment } from 'square';

export type SquareItemField = {
  id: string;
  name: string;
  optionValues?: { id: string; name: string }[];
};

const SQUARE_BUILTIN_ITEM_FIELDS: SquareItemField[] = [
  { id: 'category', name: 'Category' },
  { id: 'retail_price', name: 'Retail price' },
  { id: 'sku', name: 'SKU' },
  { id: 'description', name: 'Description' },
  { id: 'image', name: 'Images' },
  { id: 'vendor', name: 'Vendor' },
  { id: 'vendor_code', name: 'Vendor code' },
];

/** GET: Return all Square item fields (built-in + custom attribute definitions + item options) for settings. */
export async function GET(request: Request) {
  const supabase = getSupabaseClient();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

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

  const fields: SquareItemField[] = [...SQUARE_BUILTIN_ITEM_FIELDS];

  try {
    const [customRes, optionsRes] = await Promise.all([
      client.catalogApi.listCatalog(undefined, 'CUSTOM_ATTRIBUTE_DEFINITION'),
      client.catalogApi.listCatalog(undefined, 'ITEM_OPTION'),
    ]);

    (customRes.result.objects ?? []).forEach((obj) => {
      const key = (obj as { customAttributeDefinitionData?: { key?: string } }).customAttributeDefinitionData?.key;
      if (key && !fields.some((f) => f.id === key)) {
        fields.push({ id: key, name: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) });
      }
    });

    (optionsRes.result.objects ?? []).forEach((obj) => {
      const optionData = (obj as { itemOptionData?: { name?: string; choices?: { id: string; name?: string }[] } }).itemOptionData;
      const id = (obj as { id?: string }).id;
      const name = optionData?.name ?? id ?? 'Option';
      if (id && !fields.some((f) => f.id === id)) {
        const optionValues = optionData?.choices?.map((c) => ({ id: c.id, name: c.name ?? c.id })) ?? [];
        fields.push({ id, name, optionValues });
      }
    });
  } catch {
    // Return built-in only if Square catalog listing fails
  }

  const defaults: Record<string, unknown> = { ...OPTIONAL_FIELDS_DEFAULT_VALUES };
  for (const f of fields) {
    if (!(f.id in defaults)) defaults[f.id] = '';
  }
  console.log('Optional fields and default values:', JSON.stringify(Object.entries(defaults).map(([field, defaultVal]) => ({ field, default: defaultVal })), null, 2));

  return NextResponse.json({ fields });
}
