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
      product_name: i.product_name,
      quantity: i.quantity,
      price: i.price,
    })),
  });
}
