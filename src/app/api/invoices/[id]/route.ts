import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseClient();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const { data: invoice, error: invError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (invError || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const { data: items } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', id);

  return NextResponse.json({
    invoice,
    items: (items || []).map((i) => ({
      skn: i.skn ?? '',
      product_name: i.product_name,
      quantity: i.quantity,
      price: i.price,
      calculated_price: i.calculated_price != null ? Number(i.calculated_price) : null,
    })),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseClient();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const { data: invoice, error: invError } = await supabase
    .from('invoices')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (invError || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  let body: { items?: Array<{ skn?: string; product_name: string; quantity: number; price?: number; calculated_price?: number | null }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ error: 'items array required' }, { status: 400 });
  }

  await supabase.from('invoice_items').delete().eq('invoice_id', id);
  for (const item of items) {
    await supabase.from('invoice_items').insert({
      invoice_id: id,
      skn: (item.skn ?? '').trim() || null,
      product_name: item.product_name ?? '',
      quantity: Number(item.quantity) || 1,
      price: item.price != null ? Number(item.price) : null,
      calculated_price: item.calculated_price != null && !Number.isNaN(Number(item.calculated_price)) ? Number(item.calculated_price) : null,
    });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseClient();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const { data: invoice, error: invError } = await supabase
    .from('invoices')
    .select('id, file_path')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (invError || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  if (invoice.file_path) {
    try {
      await supabase.storage.from('invoices').remove([invoice.file_path]);
    } catch {
      // Continue to delete DB rows even if file is missing
    }
  }

  await supabase.from('invoice_items').delete().eq('invoice_id', id);
  const { error: deleteError } = await supabase.from('invoices').delete().eq('id', id).eq('user_id', userId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
