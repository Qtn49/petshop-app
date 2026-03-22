import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

async function getInvoiceWithAccess(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase-server').getSupabaseClient>>,
  invoiceId: string,
  userId: string
) {
  const { data: invoice, error: invError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single();

  if (invError || !invoice) return { invoice: null, error: 'Invoice not found' };

  if (invoice.user_id === userId) return { invoice };

  const { data: currentUser } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', userId)
    .single();
  const { data: ownerUser } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', invoice.user_id)
    .single();

  const sameOrg =
    currentUser?.organization_id &&
    ownerUser?.organization_id &&
    currentUser.organization_id === ownerUser.organization_id;

  if (!sameOrg) return { invoice: null, error: 'Invoice not found' };
  return { invoice };
}

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

  const { invoice, error } = await getInvoiceWithAccess(supabase, id, userId);
  if (!invoice) {
    return NextResponse.json({ error: error || 'Invoice not found' }, { status: 404 });
  }

  const { data: items } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', id);

  return NextResponse.json({
    invoice,
    items: (items || []).map((i) => ({
      id: i.id,
      skn: i.skn ?? '',
      product_name: i.product_name,
      quantity: i.quantity,
      price: i.price,
      calculated_price: i.calculated_price != null ? Number(i.calculated_price) : null,
      in_purchase_order: Boolean((i as { in_purchase_order?: boolean }).in_purchase_order),
      matched_from_supplier_history: Boolean((i as { matched_from_supplier_history?: boolean }).matched_from_supplier_history),
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

  const { invoice, error } = await getInvoiceWithAccess(supabase, id, userId);
  if (!invoice) {
    return NextResponse.json({ error: error || 'Invoice not found' }, { status: 404 });
  }

  let body: {
    items?: Array<{ skn?: string; product_name: string; quantity: number; price?: number; calculated_price?: number | null }>;
  };
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
      calculated_price:
        item.calculated_price != null && !Number.isNaN(Number(item.calculated_price))
          ? Number(item.calculated_price)
          : null,
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

  const { invoice, error } = await getInvoiceWithAccess(supabase, id, userId);
  if (!invoice) {
    return NextResponse.json({ error: error || 'Invoice not found' }, { status: 404 });
  }

  if (invoice.file_path) {
    try {
      await supabase.storage.from('invoices').remove([invoice.file_path]);
    } catch {
      // Continue to delete DB rows even if file is missing
    }
  }

  await supabase.from('invoice_items').delete().eq('invoice_id', id);
  const { error: deleteError } = await supabase.from('invoices').delete().eq('id', id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
