import type { ParsedInvoiceItem, ParsedInvoiceResult } from './types';

/**
 * Lines that look like product lines: at least one digit then a dollar price (e.g. 4.33 or $4.33).
 */
const CANDIDATE_LINE_TEST = /\d+\s*\$?\s*\d+\.\d{2}/;

/**
 * Per-line regex: CODE + NAME + QUANTITY + $PRICE
 * Example: 110361AMBULIA - 5CM POT5$4.33
 * Groups: 1 = code (4-10), 2 = name, 3 = quantity, 4 = price.
 */
const LINE_REGEX = /^([A-Z0-9]{4,10})([A-Z][A-Z0-9\s\-()]+?)(\d+)\$?(\d+\.\d{2})$/;

const INVALID_KEYWORDS = [
  'subtotal',
  'total',
  'freight',
  'packaging',
  'discount',
  'gst',
  'tax',
  'page',
];

/**
 * Returns lines that contain a dollar price and at least one digit before it.
 */
export function getCandidateLines(text: string): string[] {
  const lines = (text ?? '').split(/\r?\n/);
  return lines.filter((line) => CANDIDATE_LINE_TEST.test(line));
}

/**
 * If code has a numeric prefix (5-6 digits) and trailing letters, split so the
 * letters are prepended to the name (e.g. 110361AMBU + "LIA - 5CM POT" -> code 110361, name "AMBULIA - 5CM POT").
 */
function repairCodeAndName(code: string, name: string): { code: string; name: string } {
  const numericPrefix = code.match(/^\d{5,6}/);
  if (!numericPrefix) return { code, name };

  const prefix = numericPrefix[0];
  const suffix = code.slice(prefix.length).trim();
  if (suffix.length === 0) return { code, name };

  return {
    code: prefix,
    name: (suffix + name).replace(/\s+/g, ' ').trim(),
  };
}

function filterItem(item: ParsedInvoiceItem): boolean {
  const name = item.name.trim();
  if (name.length < 4) return false;

  const nameLower = name.toLowerCase();
  if (INVALID_KEYWORDS.some((k) => nameLower.includes(k))) return false;

  if (item.quantity <= 0 || item.quantity > 200) return false;
  if (item.price <= 0) return false;

  return true;
}

/**
 * Line-based parser: split text into lines, keep only candidate product lines,
 * then parse each with a strict regex. Avoids broken line structure in raw PDF text.
 */
export function regexParser(text: string): ParsedInvoiceResult {
  const candidateLines = getCandidateLines(text ?? '');
  const items: ParsedInvoiceItem[] = [];

  for (const line of candidateLines) {
    const m = line.match(LINE_REGEX);
    if (!m) continue;

    let code = (m[1] ?? '').trim();
    let name = (m[2] ?? '').replace(/\s+/g, ' ').trim();
    const quantity = parseInt(m[3] ?? '0', 10) || 0;
    const priceRaw = (m[4] ?? '0').replace(',', '.');
    const price = parseFloat(priceRaw) || 0;

    const repaired = repairCodeAndName(code, name);
    code = repaired.code;
    name = repaired.name;

    const item: ParsedInvoiceItem = {
      code: code || undefined,
      name,
      quantity,
      price,
    };
    if (filterItem(item)) items.push(item);
  }

  return { items };
}
