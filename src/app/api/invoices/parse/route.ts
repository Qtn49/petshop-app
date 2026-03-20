import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { parseInvoiceText } from '@/lib/invoice/parseInvoice';
import { verifyParsedItemsWithAI } from '@/lib/invoice/verifyWithAI';
import { detectSupplierFromText } from '@/lib/invoice-learning/supplierDetection';
import { preMatchBarcodes } from '@/lib/invoice-learning/preMatch';

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

    const { data: userRow } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', userId)
      .single();

    const organizationId = (userRow as { organization_id?: string } | null)?.organization_id ?? null;

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

    const supplierName = detectSupplierFromText(rawText);
    const preMatched =
      organizationId && supplierName
        ? await preMatchBarcodes(supabase, organizationId, supplierName, rawText)
        : new Map<string, { name: string; square_variation_id: string | null; last_price: string | number | null }>();
    const preMatchedBarcodes = new Set(preMatched.keys());
    const context = preMatchedBarcodes.size > 0 ? { preMatchedBarcodes } : undefined;

    const { items } = await parseInvoiceText(rawText, context);
    // Apply learned overrides without removing any items.
    // If we recognize a barcode for this supplier, we trust the learned name
    // and last_price for that barcode.
    const finalItems = items.map((it) => {
      const code = it.code ?? null;
      if (!code) return it;
      const known = preMatched.get(code);
      if (!known) return it;
      const overrideName = known.name ?? it.name;
      const overridePriceRaw = known.last_price;
      const overridePrice =
        overridePriceRaw != null && !Number.isNaN(Number(overridePriceRaw))
          ? Number(overridePriceRaw)
          : null;
      return {
        ...it,
        name: overrideName,
        price: overridePrice != null && overridePrice > 0 ? overridePrice : it.price,
      };
    });

    if (finalItems.length > 0) {
      console.log('📋 Parsed items (post-learn overrides):', JSON.stringify(finalItems, null, 2));
      console.log(sep + '\n');

      const verification = await verifyParsedItemsWithAI(rawText, finalItems);
      if (verification) {
        if (verification.valid) {
          console.log('✅ AI verification: passed');
        } else {
          console.log('⚠️ AI verification: issues found', verification.issues);
          if (verification.missingItems?.length) {
            console.log('   Missing items:', verification.missingItems);
          }
        }

        // Apply suggestedCorrections non-destructively.
        // Never remove items: only update fields on existing indices.
        if (verification.suggestedCorrections?.length) {
          for (const corr of verification.suggestedCorrections) {
            const idx = corr.index;
            const item = finalItems[idx];
            if (!item) continue;
            if (corr.field === 'name') {
              (finalItems[idx] as typeof item).name = corr.suggested;
            } else if (corr.field === 'price') {
              const p = parseFloat(String(corr.suggested).replace(/[^0-9.\-]/g, ''));
              if (!Number.isNaN(p) && p > 0) (finalItems[idx] as typeof item).price = p;
            } else if (corr.field === 'quantity') {
              const q = parseInt(String(corr.suggested).replace(/[^0-9\-]/g, ''), 10);
              if (!Number.isNaN(q) && q > 0) (finalItems[idx] as typeof item).quantity = q;
            }
          }
        }

        console.log(sep + '\n');
      }
    } else {
      console.log('⚠️ No items parsed (deterministic parser returned empty).');
      console.log(sep + '\n');
    }

    const aiPredictionJson = JSON.stringify(
      finalItems.map((i) => ({ code: i.code, name: i.name, quantity: i.quantity, price: i.price }))
    );

    const poVendorName = supplierName ?? null;
    const firstLines = rawText.split(/\r?\n/).slice(0, 40).join('\n');
    const shipToMatch = firstLines.match(/(?:ship\s+to|deliver\s+to|bill\s+to|sold\s+to)\s*:?\s*([^\n]+)/im);
    const poShipTo = shipToMatch?.[1]?.trim().replace(/\s+/g, ' ').slice(0, 500) ?? null;
    const dateMatch = firstLines.match(/(?:date|expected|due)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/im);
    const poExpectedOn = dateMatch?.[1] ?? null;

    for (const item of finalItems) {
      await supabase.from('invoice_items').insert({
        invoice_id: invoiceId,
        skn: item.code ?? null,
        product_name: item.name,
        quantity: item.quantity,
        price: item.price,
        status: 'pending',
        matched_from_supplier_history: item.matchedFromHistory ?? false,
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
        skn: i.code ?? '',
        product_name: i.name,
        quantity: i.quantity,
        price: i.price,
        matched_from_supplier_history: i.matchedFromHistory ?? false,
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
