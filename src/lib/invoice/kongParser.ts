/**
 * Robust multi-step Kong-style invoice parser.
 * Handles flattened OCR text with merged columns, multiline descriptions, alphanumeric codes.
 */

const DEBUG = process.env.INVOICE_PARSER_DEBUG === 'true';

function log(...args: unknown[]) {
  if (DEBUG) console.log('[invoice-parser]', ...args);
}

export interface RichParsedItem {
  itemCode: string | null;
  barcode: string | null;
  name: string;
  quantityOrdered: number | null;
  quantityDelivered: number | null;
  quantityBackOrder: number | null;
  unitPriceExGst: number | null;
  netPriceExGst: number | null;
  subtotalIncGst: number | null;
  units: string | null;
}

export interface LegacyParsedItem {
  code: string | null;
  sku: string | null;
  name: string;
  quantity: number;
  price: number;
}

const FOOTER_MARKERS = [
  /^ALL GOODS SHOULD BE CHECKED/i,
  /^Price \(ex GST\)/i,
  /^\$?[\d,]+\.\d{2}\s*$/,
  /^TOTAL\s*$/i,
  /^Bank Details/i,
  /^BSB\s*$/i,
  /^Reference\s*$/i,
  /^Freight\s*$/i,
  /^GST\s*$/i,
];

const HEADER_TABLE_MARKERS = [
  /^Item\s*Description\s*Item Barcode/i,
  /^Qty\s*Ord\s*Qty\s*Del/i,
  /^Unit Price\s*Disc\./i,
];

const SKIP_LINE_PATTERNS = [
  /^Page\s+\d+\/\d+$/i,
  /^PH:\s*[\d\s]+FAX:/i,
  /^Email:\s*[\w@.]+$/i,
  /^THE TRUSTEE FOR/i,
  /^PO BOX\s+\d+/i,
  /^Invoice To:/i,
  /^Delivered To:/i,
  /^\d+\s+\w+\s+STREET/i,
  /^Con Note #/i,
  /^Sales Rep$/i,
  /^Contact$/i,
  /^Account$/i,
  /^Order No\./i,
  /^Date$/i,
  /^A\.B\.N\./i,
  /^Tax Invoice\s+\d+$/i,
];

function isFooterLine(line: string): boolean {
  return FOOTER_MARKERS.some((re) => re.test(line.trim()));
}

function isHeaderTableLine(line: string): boolean {
  return HEADER_TABLE_MARKERS.some((re) => re.test(line.trim()));
}

function shouldSkipLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  return SKIP_LINE_PATTERNS.some((re) => re.test(t));
}

/**
 * Detect if a line starts a new item block.
 * - 10321Scraper... (numeric code + text)
 * - DC24Cage Cover... (alphanumeric)
 * - KIT2516Assorted... (alphanumeric)
 * - 56170 (standalone code, description follows)
 */
const REP_CODE = /^[A-Z]{2,4}\d{2,4}$/;

function isLikelyItemStart(line: string): boolean {
  const t = line.trim();
  if (t.length < 4) return false;
  if (REP_CODE.test(t)) return false;

  // Numeric code followed immediately by text (no space): 10321Scraper...
  if (/^\d{4,}[A-Za-z]/.test(t)) return true;

  // Alphanumeric code followed by text: DC24Cage..., KIT2516Assorted...
  if (/^[A-Z]{1,5}\d{1,6}[A-Za-z]/.test(t)) return true;

  // Standalone numeric code (4-6 digits only)
  if (/^\d{4,6}$/.test(t)) return true;

  // Standalone alphanumeric code
  if (/^[A-Z]{1,5}\d{1,6}$/.test(t)) return true;

  // Barcode-only line at start of block (13 digits starting with 9) - continuation of multiline
  if (/^9\d{12}\d*$/.test(t)) return false;
  return false;
}

/**
 * Check if we've entered the footer/totals section.
 */
function isFooterSection(lines: string[], fromIndex: number): boolean {
  for (let i = fromIndex; i < Math.min(fromIndex + 3, lines.length); i++) {
    if (isFooterLine(lines[i])) return true;
  }
  return false;
}

/**
 * Extract barcode: 12-14 digit token, prefer 13 digits starting with 9.
 */
function extractBarcode(text: string): string | null {
  const m13 = text.match(/9\d{12}/);
  if (m13) return m13[0];
  const m = text.match(/\b\d{12,14}\b/);
  return m ? m[0] : null;
}

/**
 * Extract item code from start of block.
 */
function extractItemCode(line: string): string | null {
  const t = line.trim();
  const numPrefix = t.match(/^(\d{4,6})/);
  if (numPrefix) return numPrefix[1];

  const alphaNum = t.match(/^([A-Z]{1,5}\d{1,6})/);
  return alphaNum ? alphaNum[1] : null;
}

/**
 * Extract quantity from start of line like "1000Each0.00100.00"
 */
function extractLeadingQty(line: string): number | null {
  const m = line.match(/^(\d{1,4})\s*(?:Each|Set|Box|Packet)/i);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Extract price line: "2.86Each2.861031.46" or "273.90Each273.9010602.58" or "295.00Set295.0010324.50" or "1000Each0.00100.00"
 */
function parsePriceLine(line: string): {
  unitPrice: number | null;
  netPrice: number | null;
  subtotalIncGst: number | null;
  units: string | null;
} {
  const t = line.trim();
  const unitsMatch = t.match(/(Each|Set|Box|Packet|kg|L|mL)/i);
  const units = unitsMatch ? unitsMatch[1] : null;

  const decimals = t.match(/\d+\.\d{2}/g);
  if (!decimals || decimals.length < 1) {
    return { unitPrice: null, netPrice: null, subtotalIncGst: null, units };
  }

  const parsed = decimals.map((d) => parseFloat(d)).filter((n) => !Number.isNaN(n));
  const first = parsed[0] ?? null;
  const second = parsed[1] ?? first;
  const last = parsed.length >= 3 ? parsed[parsed.length - 1] : second;

  return {
    unitPrice: first,
    netPrice: second,
    subtotalIncGst: last,
    units,
  };
}

/**
 * Parse a single item block into RichParsedItem.
 */
function parseItemBlock(blockLines: string[]): RichParsedItem | null {
  const blockText = blockLines.join('\n');
  log('item block', blockText);

  let itemCode: string | null = null;
  let barcode: string | null = null;
  let nameParts: string[] = [];
  let quantityDelivered: number | null = null;
  let quantityOrdered: number | null = null;
  let quantityBackOrder: number | null = null;
  let unitPriceExGst: number | null = null;
  let netPriceExGst: number | null = null;
  let subtotalIncGst: number | null = null;
  let units: string | null = null;

  let firstLine = blockLines[0]?.trim() ?? '';
  if (!firstLine) return null;

  // Case 1: Standalone code line (56170) - description on next lines
  const standaloneCode = firstLine.match(/^(\d{4,6}|[A-Z]{1,5}\d{1,6})$/);
  if (standaloneCode) {
    itemCode = standaloneCode[1];
    let i = 1;
    while (i < blockLines.length) {
      const line = blockLines[i].trim();
      const bc = extractBarcode(line);
      if (bc) {
        barcode = bc;
        break;
      }
      if (line && !/^\d+\.\d{2}/.test(line) && !/^[A-Z]{2,5}\d{2,4}$/.test(line)) {
        nameParts.push(line);
      }
      i++;
    }
  } else {
    itemCode = extractItemCode(firstLine);
    barcode = extractBarcode(firstLine);

    if (itemCode && barcode) {
      const afterCode = firstLine
        .slice(itemCode.length)
        .replace(new RegExp(barcode + '.*$'), '')
        .replace(/\d{2,}\d*\.\d+$/, '')
        .trim();
      if (afterCode && afterCode.length > 2) {
        nameParts.push(afterCode.replace(/\s+/g, ' '));
      }
    } else if (itemCode) {
      const rest = firstLine.slice(itemCode.length);
      const bc = extractBarcode(rest);
      if (bc) {
        barcode = bc;
        const beforeBc = rest.substring(0, rest.indexOf(bc)).replace(/\s+/g, ' ').trim();
        if (beforeBc.length > 2) nameParts.push(beforeBc);
      } else if (rest.trim().length > 2) {
        nameParts.push(rest.replace(/\s+/g, ' ').trim());
      }
    }
  }

  // Collect continuation name lines and find price/qty lines
  let foundBarcode = !!barcode;
  for (let i = 1; i < blockLines.length; i++) {
    const line = blockLines[i].trim();
    if (!line) continue;

    if (!foundBarcode) {
      const bc = extractBarcode(line);
      if (bc) {
        barcode = bc;
        foundBarcode = true;
        const beforeBc = line.substring(0, line.indexOf(bc)).replace(/\s+/g, ' ').trim();
        if (beforeBc.length > 2 && !/^\d+\.\d{2}/.test(beforeBc)) {
          nameParts.push(beforeBc);
        }
        continue;
      }
    }

    if (/\d+\.\d{2}.*(Each|Set|Box|Packet)/i.test(line) || /(Each|Set|Box|Packet).*\d+\.\d{2}/i.test(line) || /^\d{1,4}(Each|Set|Box|Packet)/i.test(line)) {
      const parsed = parsePriceLine(line);
      unitPriceExGst = parsed.unitPrice;
      netPriceExGst = parsed.netPrice;
      subtotalIncGst = parsed.subtotalIncGst;
      units = parsed.units;
      const qtyFromLine = extractLeadingQty(line);
      if (qtyFromLine != null && quantityDelivered == null) quantityDelivered = qtyFromLine;
      continue;
    }

    if (/^\d{1,4}$/.test(line) && quantityDelivered == null && line.length <= 4) {
      const q = parseInt(line, 10);
      if (q >= 0 && q <= 999) quantityDelivered = q;
      continue;
    }

    if (!barcode && !/^\d+\.\d{2}/.test(line) && !/^[A-Z]{2,5}\d{2,4}$/.test(line) && line.length > 2) {
      if (!/^\d{10,}/.test(line)) nameParts.push(line.replace(/\s+/g, ' ').trim());
    }
  }

  const name = nameParts
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!name || name.toLowerCase() === 'product') {
    const reconstructed = blockText
      .replace(/\d{12,14}/g, '')
      .replace(/\d+\.\d{2,}.*$/, '')
      .replace(/^[A-Z0-9]{4,10}/, '')
      .trim();
    if (reconstructed.length > 3) {
      nameParts = [reconstructed];
    }
  }

  const finalName =
    nameParts
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Unknown item';

  const rich: RichParsedItem = {
    itemCode,
    barcode,
    name: finalName,
    quantityOrdered,
    quantityDelivered,
    quantityBackOrder,
    unitPriceExGst,
    netPriceExGst,
    subtotalIncGst,
    units,
  };

  log('parsed item', rich);
  return rich;
}

function toLegacy(rich: RichParsedItem): LegacyParsedItem {
  let quantity =
    rich.quantityDelivered ?? rich.quantityOrdered ?? rich.quantityBackOrder ?? 1;
  const price =
    rich.netPriceExGst ?? rich.unitPriceExGst ?? 0;

  quantity = Math.min(Math.max(quantity, 1), 200);

  return {
    code: rich.barcode ?? rich.itemCode ?? null,
    sku: rich.barcode ?? null,
    name: rich.name,
    quantity,
    price: price >= 0 ? price : 0,
  };
}

/**
 * Detect if this looks like a Kong-style invoice.
 */
function isKongFormat(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("item barcode") ||
    lower.includes("kong") ||
    /\b9\d{12}\b/.test(text)
  );
}

/**
 * Group lines into item blocks.
 */
function groupIntoBlocks(lines: string[]): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isFooterSection(lines, i)) break;

    if (isLikelyItemStart(line) && current.length > 0) {
      if (current.some((l) => l.trim().length > 0)) {
        blocks.push(current);
      }
      current = [line];
    } else if (current.length > 0) {
      current.push(line);
    } else if (isLikelyItemStart(line)) {
      current = [line];
    }
  }
  if (current.length > 0) blocks.push(current);

  return blocks;
}

/**
 * Kong parser: multi-step extraction.
 */
export function kongParser(text: string): { items: LegacyParsedItem[]; richItems: RichParsedItem[] } {
  const trimmed = (text ?? '').trim();
  if (!trimmed || !isKongFormat(trimmed)) {
    return { items: [], richItems: [] };
  }

  const allLines = trimmed.split(/\r?\n/).map((l) => l.trim());
  const lines: string[] = [];
  let inItemSection = false;

  for (const line of allLines) {
    if (isFooterLine(line)) break;
    if (isHeaderTableLine(line)) {
      inItemSection = true;
      continue;
    }
    if (!inItemSection) {
      if (shouldSkipLine(line)) continue;
      if (/^\d{4,}[A-Za-z]/.test(line) || /^[A-Z]{1,5}\d{1,6}[A-Za-z]/.test(line) || /^9\d{12}/.test(line) || /^\d{4,6}$/.test(line)) {
        inItemSection = true;
      } else {
        continue;
      }
    }
    lines.push(line);
  }

  const blocks = groupIntoBlocks(lines);
  log('detected', blocks.length, 'item blocks');

  const richItems: RichParsedItem[] = [];
  for (const block of blocks) {
    try {
      const rich = parseItemBlock(block);
      if (rich && (rich.name !== 'Unknown item' || rich.barcode || rich.itemCode)) {
        richItems.push(rich);
      } else if (rich) {
        log('skipped block (no usable data)', block.join('|'));
      }
    } catch (err) {
      log('failed block', { blockText: block.join('\n'), reason: String(err) });
    }
  }

  const items = richItems.map(toLegacy);
  return { items, richItems };
}
