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

const sep = '─'.repeat(60);

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

    console.log('\n' + sep);
    console.log('📥 PARSE REQUEST — invoiceId:', invoiceId, 'userId:', userId);
    console.log(sep);

    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('user_id', userId)
      .single();

    if (invError || !invoice) {
      console.log('❌ Invoice not found:', invError?.message || 'No invoice');
      console.log(sep + '\n');
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

    console.log('\n' + sep);
    console.log('📄 RAW TEXT EXTRACTED FROM FILE');
    console.log(sep);
    console.log(rawText);
    console.log(sep + '\n');

    if (!rawText?.trim()) {
      console.log('❌ Extracted text is empty — check file format / content');
      console.log(sep + '\n');
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

    if (items.length > 0) {
      console.log('📋 Parsed items:', JSON.stringify(items, null, 2));
      console.log(sep + '\n');
    } else {
      console.log('⚠️ No items parsed (regex and/or AI returned empty).');
      console.log(sep + '\n');
    }

    for (const item of items) {
      await supabase.from('invoice_items').insert({
        invoice_id: invoiceId,
        skn: item.code ?? null,
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
        skn: i.code ?? '',
        product_name: i.name,
        quantity: i.quantity,
        price: i.price,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Parsing failed';
    console.log('❌ PARSE ERROR:', message);
    if (err instanceof Error && err.stack) console.log(err.stack);
    console.log(sep + '\n');
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
