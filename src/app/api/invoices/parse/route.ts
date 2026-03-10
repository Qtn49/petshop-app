import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import OpenAI from 'openai';

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

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Extract product/line items from this invoice text. Return a JSON array of objects with keys: product_name (string), quantity (number), price (number or null if not found). Example: [{"product_name":"Fish Food 5kg","quantity":2,"price":29.99}]`,
        },
        { role: 'user', content: rawText.slice(0, 8000) },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');

    const parsed = JSON.parse(content);
    const items = Array.isArray(parsed.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];

    for (const item of items) {
      await supabase.from('invoice_items').insert({
        invoice_id: invoiceId,
        product_name: item.product_name || item.name || 'Unknown',
        quantity: Number(item.quantity) || 1,
        price: item.price != null ? Number(item.price) : null,
        status: 'pending',
      });
    }

    await supabase
      .from('invoices')
      .update({ status: 'parsed' })
      .eq('id', invoiceId);

    return NextResponse.json({
      items: items.map((i: { product_name?: string; name?: string; quantity?: number; price?: number }) => ({
        product_name: i.product_name || i.name || 'Unknown',
        quantity: Number(i.quantity) || 1,
        price: i.price != null ? Number(i.price) : undefined,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Parsing failed' },
      { status: 500 }
    );
  }
}
