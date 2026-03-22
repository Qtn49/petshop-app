import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { parseInvoiceWithClaude } from '@/lib/invoice/parseWithClaude';
import { resolveInvoiceItemsSku } from '@/lib/invoice/resolveSkuInSquare';

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
      .single();

    if (invError || !invoice) {
      console.log('❌ Invoice not found:', invError?.message || 'No invoice');
      console.log(sep + '\n');
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const isOwner = invoice.user_id === userId;
    if (!isOwner) {
      const { data: currentUser } = await supabase.from('users').select('organization_id').eq('id', userId).single();
      const { data: ownerUser } = await supabase.from('users').select('organization_id').eq('id', invoice.user_id).single();
      const sameOrg =
        currentUser?.organization_id &&
        ownerUser?.organization_id &&
        currentUser.organization_id === ownerUser.organization_id;
      if (!sameOrg) {
        console.log('❌ Invoice not found: access denied (different org)');
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      }
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

    const { items: claudeItems, totals: invoiceTotals } = await parseInvoiceWithClaude(rawText);

    if (claudeItems.length === 0) {
      console.log('⚠️ No items parsed (Claude returned empty).');
      console.log(sep + '\n');
    }

    const { data: squareConn } = await supabase
      .from('square_connections')
      .select('access_token')
      .eq('user_id', userId)
      .maybeSingle();
    const squareToken =
      squareConn?.access_token && String(squareConn.access_token).length > 0
        ? String(squareConn.access_token)
        : null;

    const finalItems = await resolveInvoiceItemsSku(claudeItems, squareToken);

    const aiPredictionJson = JSON.stringify({
      items: finalItems.map((i) => ({
        code: i.code,
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        resolvedSku: i.resolvedSku,
        potentialNewItem: i.potentialNewItem,
        matchMethod: i.matchMethod,
        vendorCode: i.vendorCode ?? null,
        quantityOrdered: i.quantityOrdered ?? null,
        quantityDelivered: i.quantityDelivered ?? null,
        quantityBackOrder: i.quantityBackOrder ?? null,
        unitPriceList: i.unitPriceList ?? null,
        discountPercent: i.discountPercent ?? null,
        lineSubtotalExGst: i.lineSubtotalExGst ?? null,
        lineSubtotalIncGst: i.lineSubtotalIncGst ?? null,
        isFreeItem: i.isFreeItem ?? false,
      })),
      totals: invoiceTotals,
    });

    const firstLines = rawText.split(/\r?\n/).slice(0, 40).join('\n');
    const shipToMatch = firstLines.match(/(?:ship\s+to|deliver\s+to|bill\s+to|sold\s+to)\s*:?\s*([^\n]+)/im);
    const poShipTo = shipToMatch?.[1]?.trim().replace(/\s+/g, ' ').slice(0, 500) ?? null;
    const dateMatch = firstLines.match(/(?:date|expected|due)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/im);
    const poExpectedOn = dateMatch?.[1] ?? null;

    const idx = firstLines.toLowerCase().search(/(?:tax\s+invoice|invoice\s+(?:no|#|number)|a\.?b\.?n\.?|date\s*:)/i);
    let poVendorName: string | null = null;
    if (idx > 0) {
      const before = firstLines.slice(0, idx).trim();
      const lastLine = before.split('\n').pop()?.trim();
      if (lastLine && lastLine.length >= 3 && lastLine.length <= 120 && !/^\d+$/.test(lastLine)) {
        poVendorName = lastLine.replace(/\s+/g, ' ');
      }
    }

    for (const item of finalItems) {
      await supabase.from('invoice_items').insert({
        invoice_id: invoiceId,
        skn: item.resolvedSku ?? item.code ?? null,
        product_name: item.name,
        quantity: item.quantity,
        price: item.price,
        status: item.dbStatus,
        matched_from_supplier_history: false,
      });
    }

    await supabase
      .from('invoices')
      .update({
        status: 'parsed',
        raw_text: rawText,
        ai_prediction_json: aiPredictionJson as unknown,
        po_vendor_name: poVendorName,
        po_ship_to: poShipTo,
        po_expected_on: poExpectedOn,
      })
      .eq('id', invoiceId);

    return NextResponse.json({
      items: finalItems.map((i) => ({
        skn: i.resolvedSku ?? i.code ?? '',
        product_name: i.name,
        quantity: i.quantity,
        price: i.price,
        matched_from_supplier_history: false,
        resolvedSku: i.resolvedSku,
        potentialNewItem: i.potentialNewItem,
        matchMethod: i.matchMethod,
        status: i.dbStatus,
        vendorCode: i.vendorCode ?? null,
        quantityOrdered: i.quantityOrdered ?? null,
        quantityDelivered: i.quantityDelivered ?? null,
        quantityBackOrder: i.quantityBackOrder ?? null,
        unitPriceList: i.unitPriceList ?? null,
        discountPercent: i.discountPercent ?? null,
        lineSubtotalExGst: i.lineSubtotalExGst ?? null,
        lineSubtotalIncGst: i.lineSubtotalIncGst ?? null,
        isFreeItem: i.isFreeItem ?? false,
      })),
      totals: invoiceTotals,
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
