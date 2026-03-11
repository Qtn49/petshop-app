import type { ParsedInvoiceItem, ParsedInvoiceResult } from './types';

const HEADER_MARKERS = ['Invoice Number', 'Customer Ref', 'Date', 'Item,Description'];
const PRODUCT_LINE_REGEX = /^\d+,.+,\d{8,14},\d+/;

function isHeaderLine(line: string): boolean {
  const trimmed = line.trim();
  return HEADER_MARKERS.some((m) => trimmed.includes(m));
}

function isValidItem(code: string, name: string, quantity: number): boolean {
  if ((name ?? '').trim().length < 3) return false;
  if (quantity <= 0) return false;
  if ((code ?? '').trim().length < 8) return false;
  return true;
}

/**
 * CSV parser for invoices with "Item Barcode" header and comma-separated product rows.
 * Runs before regex and Groq. Does not modify existing parsers.
 */
export function csvParser(text: string): ParsedInvoiceResult {
  const trimmed = text?.trim() ?? '';
  const isCSV = trimmed.includes('Item Barcode') && trimmed.includes(',');
  if (!isCSV) {
    return { items: [] };
  }

  const lines = trimmed.split(/\r?\n/);
  const productLines = lines.filter(
    (line) =>
      line.includes(',') &&
      !isHeaderLine(line) &&
      PRODUCT_LINE_REGEX.test(line.trim())
  );

  const items: ParsedInvoiceItem[] = [];

  for (const line of productLines) {
    const parts = line.split(',');
    if (parts.length < 7) continue;

    const code = (parts[2] ?? '').trim();
    const name = (parts[1] ?? '').trim();
    const quantity = Number(parts[3]);
    const price = Number(parts[6]) || 0;

    if (!isValidItem(code, name, quantity)) continue;

    items.push({
      code,
      name,
      quantity,
      price,
    });
  }

  if (items.length > 0) {
    console.log('CSV parsing success');
    console.log('CSV parsing found', items.length, 'items');
    return { items };
  }

  return { items: [] };
}
