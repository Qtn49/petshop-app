import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { parseInvoiceText } from '@/lib/invoice/parseInvoice';

async function extractTextFromFile(
  supabase: Awaited<ReturnType<typeof getSupabaseClient>>,
  filePath: string,
  fileType: string
): Promise<string> {
  const { data } = await supabase.storage.from('invoices').download(filePath);
  if (!data) throw new Error('File not found');

  const ext = filePath.split('.').pop()?.toLowerCase();

  if (ext === 'csv') {
    return await data.text();
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const XLSX = await import('xlsx');
    const buffer = await data.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_csv(sheet);
  }

  if (ext === 'pdf') {
    const pdfParse = (await import('pdf-parse')).default;
    const buffer = Buffer.from(await data.arrayBuffer());
    const pdfData = await pdfParse(buffer);
    return pdfData.text;
  }

  throw new Error('Unsupported file type');
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseClient();
    const { invoiceId, userId } = await request.json();

    if (!invoiceId || !userId) {
      return NextResponse.json(
        { error: 'invoiceId and userId required' },
        { status: 400 }
      );
    }

    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('user_id', userId)
      .single();

    if (invError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Allow re-parse: remove existing items so we don't duplicate
    await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);

    await supabase
      .from('invoices')
      .update({ status: 'parsing' })
      .eq('id', invoiceId);

    const rawText = await extractTextFromFile(
      supabase,
      invoice.file_path,
      invoice.file_type
    );

    if (!rawText?.trim()) {
      await supabase
        .from('invoices')
        .update({ status: 'error' })
        .eq('id', invoiceId);
      return NextResponse.json(
        { error: 'Could not extract text from file' },
        { status: 400 }
      );
    }

    const { items } = await parseInvoiceText(rawText);

    for (const item of items) {
      await supabase.from('invoice_items').insert({
        invoice_id: invoiceId,
        product_name: item.name,
        quantity: item.quantity,
        price: item.price,
        status: 'pending',
      });
    }

    await supabase
      .from('invoices')
      .update({ status: 'parsed' })
      .eq('id', invoiceId);

    return NextResponse.json({
      items: items.map((i) => ({
        product_name: i.name,
        quantity: i.quantity,
        price: i.price,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Parsing failed';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
