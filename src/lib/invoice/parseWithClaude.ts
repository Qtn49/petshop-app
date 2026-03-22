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
  /** Optional rich fields — backward-compatible, only present when Claude extracts them */
  vendorCode?: string | null;
  quantityOrdered?: number | null;
  quantityDelivered?: number | null;
  quantityBackOrder?: number | null;
  unitPriceList?: number | null;
  discountPercent?: number | null;
  lineSubtotalExGst?: number | null;
  lineSubtotalIncGst?: number | null;
  isFreeItem?: boolean;
};

export type InvoiceTotals = {
  freight: number | null;
  totalExGst: number | null;
  totalGst: number | null;
  totalIncGst: number | null;
};

const SYSTEM_PROMPT = `You are an expert invoice line item extractor for
an Australian pet shop. Extract ALL product line items, including free/promo items.

This is a multi-page document — treat the entire text as one continuous invoice.
Column headers may repeat on each page; ignore repeated headers.

COLUMN IDENTIFICATION — Australian pet shop invoices (e.g. Kong's) typically have:
Item Code | Description | Item Barcode | Qty Ord | Qty Del | Qty BO | Unit Price | Disc. | Nett Price Ex GST | Sub Total Ex GST | GST % | Sub Total Inc GST

Rules for each field:

CODE: Use the BARCODE column (long numeric string, 10-14 digits) if present.
If no barcode, use the Item Code (short alphanumeric like "KDT3", "DC24", "99643").
NEVER concatenate two separate numbers. Max barcode length: 14 digits.

VENDOR_CODE: The short Item Code / vendor code (e.g. "11577", "47375", "99643").
Always extract this separately from the barcode.

NAME: The product description only. Clean and readable. No codes, no
numbers, no price fragments. Multi-line descriptions should be joined.

QUANTITIES:
- quantityOrdered: from "Qty Ord" column
- quantityDelivered: from "Qty Del" column — this is the PRIMARY quantity
- quantityBackOrder: from "Qty BO" column (items on back-order)

PRICES:
- unitPriceList: the list/catalog unit price before discount
- discountPercent: the discount percentage (0 if none, 100 if free item).
  Note: "1000" in the discount column means 100.0% discount.
- unitPriceNett: the net unit price after discount (from "Nett Price Ex GST")
- lineSubtotalExGst: unitPriceNett × quantityDelivered (from "Sub Total Ex GST")
- lineSubtotalIncGst: from "Sub Total Inc GST" column if present

FREE ITEMS: Items with 100% discount (Disc = 1000 or nett price = $0.00) are
real products being given for free. They MUST be included with:
- unitPriceNett: 0
- isFreeItem: true
This includes display items, header cards, sample products, promo toys, etc.
Do NOT skip them.

ITEMS WITH Qty Del = 0: Include them only if Qty BO > 0 (back-ordered).
Set quantityDelivered = 0 and note them as back-ordered.

SKIP these lines entirely:
- FREIGHT line (extract its value into the totals object instead)
- GST summary lines, grand totals, subtotals
- Header rows (Item / Description / Barcode / Qty...)
- Legal notices ("ALL GOODS SHOULD BE CHECKED...")
- Bank details, BSB, account numbers
- Completely empty lines with no product data

FREIGHT & TOTALS: Extract the invoice-level totals separately.

Return a valid JSON object (no markdown, no backticks). Format:
{
  "items": [
    {
      "code": "barcode or item code if no barcode",
      "vendorCode": "short item/vendor code",
      "name": "clean product name",
      "quantityOrdered": number,
      "quantityDelivered": number,
      "quantityBackOrder": number,
      "unitPriceList": number,
      "discountPercent": number,
      "unitPriceNett": number,
      "lineSubtotalExGst": number,
      "lineSubtotalIncGst": number or null,
      "isFreeItem": boolean
    }
  ],
  "totals": {
    "freight": number or null,
    "totalExGst": number or null,
    "totalGst": number or null,
    "totalIncGst": number or null
  }
}`;

/** Light cleanup: remove only truly useless noise, keep product lines + totals/freight. */
function cleanRawText(rawText: string): string {
  const noiseMarkers = [
    'ALL GOODS SHOULD BE CHECKED',
    'ALL GOODS APPEARING',
    'Bank Details',
    'BSB',
    'Reference',
    'PH:',
    'FAX:',
    'Email:',
    'A.B.N',
    'Sales Rep',
    'Con Note',
    'Contact',
    'Order No',
    'Account',
    'Invoice To',
    'Delivered To',
    'Pty',
    'Ltd',
    'Limited',
    'PO BOX',
  ];

  const lines = rawText.split(/\r?\n/);

  const withoutNoise = lines.filter((line) => {
    const upper = line.toUpperCase();
    for (const m of noiseMarkers) {
      if (upper.includes(m.toUpperCase())) return false;
    }
    return true;
  });

  const joined = withoutNoise.join('\n');
  const collapsed = joined.replace(/\n{3,}/g, '\n\n');
  return collapsed.trim();
}

/** Correct barcode digit corruption (e.g. qty column concatenated → 13 digits instead of 12). */
function fixBarcode(code: string | null, rawText: string): string | null {
  if (!code) return null;
  const digits = code.replace(/\D/g, '');

  // Valid barcode lengths: 8, 12, 13, 14 digits
  // If 13 digits starting with 0: likely 12-digit barcode with extra digit
  if (digits.length === 13 && digits.startsWith('0')) {
    // Try removing last digit and check if 12-digit version appears in rawText
    const candidate12 = digits.slice(0, 12);
    if (rawText.includes(candidate12)) return candidate12;
    // Try removing first digit
    const candidate12b = digits.slice(1);
    if (rawText.includes(candidate12b)) return candidate12b;
  }

  // If longer than 14: truncate to 13
  if (digits.length > 14) return digits.slice(0, 13);

  // Return original if reasonable length
  if (digits.length >= 8) return digits;

  // Too short: keep as vendor code (< 8 digits = likely item code not barcode)
  return code;
}

function validateItems(items: ParsedItem[], originalRawText: string): ParsedItem[] {
  return items
    .filter((item) => {
      if (!item.name || item.name.trim().length < 2) return false;
      const lowerName = item.name.toLowerCase();
      // Only skip non-product summary lines, not real products
      if (
        lowerName.includes('freight') ||
        lowerName.includes('gst') ||
        lowerName.includes('total') ||
        lowerName.includes('subtotal') ||
        lowerName.includes('bank detail')
      ) {
        return false;
      }
      return true;
    })
    .map((item) => {
      let code = fixBarcode(item.code, originalRawText);
      const digitsOnly = code ? code.replace(/\D/g, '') : '';
      if (code && digitsOnly.length > 14) {
        code = digitsOnly.slice(0, 14);
      }
      const price = isNaN(item.price) || item.price < 0 ? 0 : item.price;
      // Keep quantity as-is if valid; only default to 1 if missing/invalid
      const quantity = !item.quantity || item.quantity < 0 ? 1 : item.quantity;
      return { ...item, code, price, quantity };
    });
}

/** Validate arithmetic consistency and log warnings. */
function arithmeticValidation(items: ParsedItem[], totals: InvoiceTotals): void {
  for (const item of items) {
    if (
      item.price != null &&
      item.quantityDelivered != null &&
      item.lineSubtotalExGst != null &&
      item.quantityDelivered > 0
    ) {
      const expected = item.price * item.quantityDelivered;
      const diff = Math.abs(expected - item.lineSubtotalExGst);
      if (diff > 0.02) {
        console.log(
          `⚠️ Arithmetic mismatch: "${item.name}" — ${item.price} × ${item.quantityDelivered} = ${expected.toFixed(2)}, but lineSubtotalExGst = ${item.lineSubtotalExGst}`
        );
      }
    }
  }

  if (totals.totalExGst != null) {
    const sumSubtotals = items.reduce((acc, it) => acc + (it.lineSubtotalExGst ?? 0), 0);
    const freight = totals.freight ?? 0;
    const diff = Math.abs(sumSubtotals + freight - totals.totalExGst);
    if (diff > 0.10) {
      console.log(
        `⚠️ Total mismatch: sum of subtotals (${sumSubtotals.toFixed(2)}) + freight (${freight.toFixed(2)}) = ${(sumSubtotals + freight).toFixed(2)}, but totalExGst = ${totals.totalExGst}`
      );
    }
  }
}

export async function parseInvoiceWithClaude(rawText: string): Promise<{ items: ParsedItem[]; totals: InvoiceTotals }> {
  const emptyTotals: InvoiceTotals = { freight: null, totalExGst: null, totalGst: null, totalIncGst: null };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('⚠️ ANTHROPIC_API_KEY not set — returning empty items');
    return { items: [], totals: emptyTotals };
  }

  const cleanedText = cleanRawText(rawText);

  try {
    const client = new Anthropic({ apiKey });
    console.log('📤 Cleaned text sent to Claude (first 500 chars):', cleanedText.slice(0, 500));
    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8192,
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

    if (!rawContent) return { items: [], totals: emptyTotals };

    let content = rawContent
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    // Try parsing as object { items, totals } first, fall back to array
    let items: ParsedItem[] = [];
    let totals: InvoiceTotals = { ...emptyTotals };

    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        // Legacy array format
        items = parsed;
      } else if (parsed && typeof parsed === 'object') {
        // New object format { items, totals }
        items = Array.isArray(parsed.items) ? parsed.items : [];
        if (parsed.totals && typeof parsed.totals === 'object') {
          totals = {
            freight: typeof parsed.totals.freight === 'number' ? parsed.totals.freight : null,
            totalExGst: typeof parsed.totals.totalExGst === 'number' ? parsed.totals.totalExGst : null,
            totalGst: typeof parsed.totals.totalGst === 'number' ? parsed.totals.totalGst : null,
            totalIncGst: typeof parsed.totals.totalIncGst === 'number' ? parsed.totals.totalIncGst : null,
          };
        }
      }
    } catch {
      // Try extracting array from malformed response
      const arrMatch = content.match(/\[[\s\S]*\]/);
      if (arrMatch) {
        try {
          items = JSON.parse(arrMatch[0]);
        } catch {
          console.log('❌ JSON parse failed, raw content:', content.slice(0, 200));
        }
      } else {
        console.log('❌ JSON parse failed, raw content:', content.slice(0, 200));
      }
    }

    // Normalize items — map rich fields to ParsedItem
    items = items.map((it) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = it as any;
      const quantityDelivered = typeof raw.quantityDelivered === 'number' ? raw.quantityDelivered : null;
      const quantityOrdered = typeof raw.quantityOrdered === 'number' ? raw.quantityOrdered : null;
      const quantity = quantityDelivered ?? quantityOrdered ?? (typeof raw.quantity === 'number' ? raw.quantity : 1);
      const unitPriceNett = typeof raw.unitPriceNett === 'number' ? raw.unitPriceNett : null;
      const price = unitPriceNett ?? (typeof raw.price === 'number' ? raw.price : parseFloat(String(raw.price ?? 0)) || 0);

      return {
        code: raw.code != null ? String(raw.code) : null,
        name: raw.name != null ? String(raw.name) : '',
        quantity,
        price,
        vendorCode: raw.vendorCode != null ? String(raw.vendorCode) : null,
        quantityOrdered: quantityOrdered,
        quantityDelivered: quantityDelivered,
        quantityBackOrder: typeof raw.quantityBackOrder === 'number' ? raw.quantityBackOrder : null,
        unitPriceList: typeof raw.unitPriceList === 'number' ? raw.unitPriceList : null,
        discountPercent: typeof raw.discountPercent === 'number' ? raw.discountPercent : null,
        lineSubtotalExGst: typeof raw.lineSubtotalExGst === 'number' ? raw.lineSubtotalExGst : null,
        lineSubtotalIncGst: typeof raw.lineSubtotalIncGst === 'number' ? raw.lineSubtotalIncGst : null,
        isFreeItem: raw.isFreeItem === true || (unitPriceNett === 0 && quantityDelivered != null && quantityDelivered > 0),
      };
    });

    items = validateItems(items, rawText);

    // Arithmetic validation
    arithmeticValidation(items, totals);

    console.log('✅ Final items after validation:', items.length, 'items');
    const freeItems = items.filter((i) => i.isFreeItem);
    if (freeItems.length > 0) {
      console.log(
        'ℹ️ Free/promo items:',
        freeItems.map((i) => i.name)
      );
    }
    if (totals.freight != null) {
      console.log('📦 Freight:', totals.freight);
    }
    if (totals.totalIncGst != null) {
      console.log('💰 Total Inc GST:', totals.totalIncGst);
    }

    return { items, totals };
  } catch (err) {
    console.log('❌ parseInvoiceWithClaude error:', err instanceof Error ? err.message : String(err));
    return { items: [], totals: emptyTotals };
  }
}
