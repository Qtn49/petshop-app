import type { ParsedInvoiceItem, ParsedInvoiceResult } from './types';

/**
 * Lines that look like product lines: digit(s) and a decimal price (e.g. 4.33, $4.33, or 101002.860).
 */
const CANDIDATE_LINE_TEST = /\d+\.\d{2,3}\d*$|\d+\s*\$?\s*\d+\.\d{2}/;

/**
 * Per-line regex: CODE + NAME + QUANTITY + $PRICE
 * Example: 110361AMBULIA - 5CM POT5$4.33
 * Groups: 1 = code (4-10), 2 = name, 3 = quantity, 4 = price.
 */
const LINE_REGEX = /^([A-Z0-9]{4,10})([A-Z][A-Z0-9\s\-()]+?)(\d+)\$?(\d+\.\d{2})$/;

/**
 * Kong-style invoice: ITEM_CODE (4-6 digits) + DESCRIPTION + BARCODE (13 digits, often 9…) + QTY_BLOCK + PRICE (decimal)
 * Example: 10321Scraper 4 In 1 24in  60cm9325136000511101002.860
 * Groups: 1 = item code, 2 = description, 3 = barcode (SKU), 4 = qty block, 5 = price.
 */
const KONG_LINE_REGEX = /^(\d{4,6})(.+?)(9\d{12})(\d{2,6})(\d+\.\d{2})\d*$/;

/**
 * Kong continuation line (description on previous lines): BARCODE + QTY_BLOCK + PRICE at start.
 * Example: 9325136082425220273.900
 */
const KONG_BARCODE_FIRST_REGEX = /^(9\d{12})(\d{2,3})(\d+\.\d{2})\d*$/;

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
 * Parse Kong-style line: barcode is SKU, first digit of qty block = quantity.
 */
function parseKongLine(m: RegExpMatchArray, nameOverride?: string): ParsedInvoiceItem | null {
  const itemCode = (m[1] ?? '').trim();
  const name = nameOverride ?? (m[2] ?? '').replace(/\s+/g, ' ').trim();
  const barcode = (m[3] ?? '').trim();
  const qtyBlock = (m[4] ?? '').trim();
  const priceRaw = (m[5] ?? '0').replace(',', '.');
  const price = parseFloat(priceRaw) || 0;

  if (price <= 0) return null;
  if (!nameOverride && name.length < 2) return null;

  let quantity = 1;
  if (qtyBlock.length >= 1) {
    quantity = parseInt(qtyBlock[0], 10) || 1;
    if (quantity <= 0 || quantity > 200) quantity = 1;
  }

  return {
    code: barcode || itemCode || undefined,
    name: name || 'Product',
    quantity,
    price,
  };
}

/**
 * Parse Kong line that starts with barcode (no description on this line).
 */
function parseKongBarcodeFirstLine(m: RegExpMatchArray): ParsedInvoiceItem | null {
  const barcode = (m[1] ?? '').trim();
  const qtyBlock = (m[2] ?? '').trim();
  const priceRaw = (m[3] ?? '0').replace(',', '.');
  const price = parseFloat(priceRaw) || 0;

  if (price <= 0) return null;

  let quantity = 1;
  if (qtyBlock.length >= 1) {
    quantity = parseInt(qtyBlock[0], 10) || 1;
    if (quantity <= 0 || quantity > 200) quantity = 1;
  }

  return {
    code: barcode || undefined,
    name: 'Product',
    quantity,
    price,
  };
}

/**
 * Line-based parser: split text into lines, keep only candidate product lines,
 * then parse each with LINE_REGEX or Kong-style KONG_LINE_REGEX.
 */
export function regexParser(text: string): ParsedInvoiceResult {
  const candidateLines = getCandidateLines(text ?? '');
  const items: ParsedInvoiceItem[] = [];

  for (const line of candidateLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let item: ParsedInvoiceItem | null = null;

    const kongMatch = trimmed.match(KONG_LINE_REGEX);
    if (kongMatch) {
      item = parseKongLine(kongMatch);
    }
    if (!item && trimmed.match(KONG_BARCODE_FIRST_REGEX)) {
      const barcodeFirst = trimmed.match(KONG_BARCODE_FIRST_REGEX);
      if (barcodeFirst) item = parseKongBarcodeFirstLine(barcodeFirst);
    }

    if (!item) {
      const m = trimmed.match(LINE_REGEX);
      if (!m) continue;

      let code = (m[1] ?? '').trim();
      let name = (m[2] ?? '').replace(/\s+/g, ' ').trim();
      const quantity = parseInt(m[3] ?? '0', 10) || 0;
      const priceRaw = (m[4] ?? '0').replace(',', '.');
      const price = parseFloat(priceRaw) || 0;

      const repaired = repairCodeAndName(code, name);
      code = repaired.code;
      name = repaired.name;

      item = {
        code: code || undefined,
        name,
        quantity,
        price,
      };
      if (!filterItem(item)) continue;
    } else {
      if (!filterItem(item)) continue;
    }

    items.push(item);
  }

  return { items };
}
