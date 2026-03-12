import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

/**
 * POST /api/invoices/[id]/items/reenable?userId=...
 * Sets in_purchase_order = false for all items of this invoice so they can be added to a purchase order again.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: invoiceId } = await params;
  const supabase = getSupabaseClient();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const { data: invoice, error: invError } = await supabase
    .from('invoices')
    .select('id')
    .eq('id', invoiceId)
    .eq('user_id', userId)
    .single();

  if (invError || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from('invoice_items')
    .update({ in_purchase_order: false })
    .eq('invoice_id', invoiceId);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message ?? 'Failed to re-enable items' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, message: 'Items re-enabled for purchase order' });
}
