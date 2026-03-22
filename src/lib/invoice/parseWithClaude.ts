/**
 * Parse invoice line items from raw text using Claude.
 */

import Anthropic from '@anthropic-ai/sdk';

const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

export type ParsedItem = {
  code: string | null;
  name: string;
  quantity: number;
  price: number;
};

const SYSTEM_PROMPT = `You are an expert invoice line item extractor for
an Australian pet shop. Extract ONLY purchasable product line items.

COLUMN IDENTIFICATION — This is critical:
Australian pet shop invoices typically have these columns in order:
Item Code | Description | Barcode | Qty Ordered | Qty Delivered | Qty Backorder | Unit Price | Discount | Nett Price | ...

Rules for each field:

CODE: Use the BARCODE column (long numeric string, 10-14 digits) if present.
If no barcode, use the Item Code (short alphanumeric like "KDT3", "DC24").
NEVER concatenate two separate numbers. The barcode is a single unbroken
number. If unsure between two candidates, pick the shorter one that looks
like a barcode (starts with 9 for Australian products, or 0 for US).
Max barcode length: 14 digits. If a number is longer than 14 digits,
it is NOT a barcode — skip it.

NAME: The product description only. Clean and readable. No codes, no
numbers, no price fragments. Multi-line descriptions should be joined.

QUANTITY: Use the "Qty Delivered" or "Qty Del" or "Shipped" column —
NOT the "Qty Ordered" or "Qty Ord" column. These are the actual units
received. If you cannot find a "delivered" column, use the smallest
non-zero quantity number on the line.

PRICE: Use the "Nett Price Ex GST" column — this is the actual net unit
price paid after discount. It is NEVER 0 for a real product unless it is
explicitly a free/sample/display item (Disc = 100% or price list = 0).
If a product has 1000 in the discount column, price = 0 is correct —
these are free display/sample items, include them with price: 0.

SKIP these lines entirely:
- FREIGHT, freight charges, delivery fees
- GST summary lines, totals, subtotals  
- Header rows (Item / Description / Barcode / Qty...)
- Legal notices ("ALL GOODS SHOULD BE CHECKED...")
- Bank details, BSB, account numbers
- Display/marketing materials with no barcode AND price = 0
  (Header cards, display bins with item codes like "99633", "99643")
- Items where Qty Delivered = 0 (backordered, not received)

IMPORTANT: Return ONLY a valid JSON array. No markdown, no backticks,
no explanation. Start your response with [ and end with ].

Format:
[
  {
    "code": "barcode or item code",
    "name": "clean product name",
    "quantity": number,
    "price": number
  }
]`;

/** Strip invoice noise before sending to Claude (original rawText unchanged for DB). */
function cleanRawText(rawText: string): string {
  const headerFooterMarkers = [
    'ALL GOODS SHOULD BE CHECKED',
    'ALL GOODS APPEARING',
    'Bank Details',
    'BSB',
    'Reference',
    'Price (ex GST)',
    'Freight',
    'GST',
    'TOTAL',
    'Invoice To',
    'Delivered To',
    'Page',
    'PH:',
    'FAX:',
    'Email:',
    'A.B.N',
    'Sales Rep',
    'Con Note',
    'Contact',
    'Order No',
    'Account',
    'Date',
    'Tax Invoice',
    'Pty',
    'Ltd',
    'Limited',
    'Street',
    'Road',
    'Avenue',
    'QLD',
    'NSW',
    'VIC',
    'WA',
    'SA',
    'TAS',
    'ACT',
    'PO BOX',
    'Sub Total',
    'Ex GST',
    'Inc GST',
  ];

  const lines = rawText.split(/\r?\n/);

  const withoutNoise = lines.filter((line) => {
    const upper = line.toUpperCase();
    for (const m of headerFooterMarkers) {
      if (upper.includes(m.toUpperCase())) return false;
    }
    return true;
  });

  const headerRowWords = ['item', 'description', 'barcode', 'qty', 'price'];
  const withoutTableHeaders = withoutNoise.filter((line) => {
    const lower = line.toLowerCase();
    const hasAll = headerRowWords.every((w) => lower.includes(w));
    return !hasAll;
  });

  const joined = withoutTableHeaders.join('\n');
  const collapsed = joined.replace(/\n{3,}/g, '\n\n');
  return collapsed.trim();
}

function validateItems(items: ParsedItem[]): ParsedItem[] {
  return items
    .filter((item) => {
      if (!item.name || item.name.trim().length < 2) return false;
      if (item.quantity === 0) return false;
      const lowerName = item.name.toLowerCase();
      if (
        lowerName.includes('freight') ||
        lowerName.includes('gst') ||
        lowerName.includes('total') ||
        lowerName.includes('subtotal') ||
        lowerName.includes('bank detail') ||
        lowerName.includes('header card') ||
        (lowerName.includes('display bin') && item.price === 0)
      ) {
        return false;
      }
      return true;
    })
    .map((item) => {
      const digitsOnly = item.code ? item.code.replace(/\D/g, '') : '';
      let code: string | null = item.code;
      if (item.code && digitsOnly.length > 14) {
        code = digitsOnly.slice(0, 14);
      }
      const price = isNaN(item.price) || item.price < 0 ? 0 : item.price;
      const quantity = !item.quantity || item.quantity < 1 ? 1 : item.quantity;
      return { ...item, code, price, quantity };
    });
}

export async function parseInvoiceWithClaude(rawText: string): Promise<{ items: ParsedItem[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('⚠️ ANTHROPIC_API_KEY not set — returning empty items');
    return { items: [] };
  }

  const cleanedText = cleanRawText(rawText);

  try {
    const client = new Anthropic({ apiKey });
    console.log('📤 Cleaned text sent to Claude (first 500 chars):', cleanedText.slice(0, 500));
    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: cleanedText }],
    });

    let rawContent: string | null = null;
    if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block && typeof block === 'object' && 'type' in block && block.type === 'text' && 'text' in block) {
          const t = (block as { text?: string }).text;
          rawContent = typeof t === 'string' ? t.trim() : null;
          break;
        }
      }
    }

    console.log('📋 Claude raw response:', rawContent ?? '(no text block)');

    if (!rawContent) return { items: [] };

    let content = rawContent
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const arrMatch = content.match(/\[[\s\S]*\]/);
    if (arrMatch) content = arrMatch[0];

    let items: ParsedItem[] = [];
    try {
      const parsed = JSON.parse(content);
      items = Array.isArray(parsed) ? parsed : [];
    } catch {
      console.log('❌ JSON parse failed, raw content:', content.slice(0, 200));
      items = [];
    }

    items = items.map((it) => ({
      code: it?.code != null ? String(it.code) : null,
      name: it?.name != null ? String(it.name) : '',
      quantity: typeof it?.quantity === 'number' ? it.quantity : Number(it?.quantity) || 1,
      price: typeof it?.price === 'number' ? it.price : parseFloat(String(it?.price ?? 0)) || 0,
    }));

    items = validateItems(items);

    console.log('✅ Final items after validation:', items.length, 'items');
    const zeroPrice = items.filter((i) => i.price === 0);
    if (zeroPrice.length > 0) {
      console.log(
        'ℹ️ Items with $0 price (free/display):',
        zeroPrice.map((i) => i.name)
      );
    }

    return { items };
  } catch (err) {
    console.log('❌ parseInvoiceWithClaude error:', err instanceof Error ? err.message : String(err));
    return { items: [] };
  }
}
