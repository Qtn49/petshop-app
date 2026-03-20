/**
 * Generic 3-stage deterministic invoice parser.
 * No AI/LLM. Regex and heuristics only.
 * Works across different invoice layouts.
 */

const DEBUG = process.env.INVOICE_PARSER_DEBUG === 'true';

function log(...args: unknown[]) {
  if (DEBUG) console.log('[invoice-parser]', ...args);
}

export interface ParsedInvoiceItemRich {
  itemCode: string | null;
  barcode: string | null;
  name: string;
  quantityOrdered: number | null;
  quantityDelivered: number | null;
  quantityBackOrder: number | null;
  unitPrice: number | null;
  netPrice: number | null;
  subtotal: number | null;
  unitLabel: string | null;
  rawBlock: string;
  confidence: number;
}

export interface LegacyParsedItem {
  code: string | null;
  sku: string | null;
  name: string;
  quantity: number;
  price: number;
}

const HEADER_FOOTER_KEYWORDS = [
  'tax invoice',
  'a.b.n.',
  'abn',
  'date',
  'account',
  'order no',
  'order #',
  'contact',
  'sales rep',
  'con note',
  'page',
  'phone',
  'fax',
  'email:',
  'invoice to',
  'delivered to',
  'bank details',
  'bsb',
  'reference',
  'freight',
  'gst',
  'total',
  'subtotal',
  'all goods should be checked',
  'item description',
  'item barcode',
  'qty ord',
  'qty del',
  'unit price',
  'disc.',
  'the trustee for',
  'po box',
];

const UNIT_LABELS = ['each', 'set', 'box', 'pack', 'packet', 'kg', 'l', 'ml', 'unit', 'pair'];

function isHeaderFooterLine(line: string): boolean {
  const t = line.trim().toLowerCase();
  if (t.length < 3) return true;
  if (/^\d+\/\d+$/.test(t)) return true;
  if (/^\$?[\d,]+\.\d{2}\s*$/.test(t)) return true;
  return HEADER_FOOTER_KEYWORDS.some((k) => t.includes(k) || t.startsWith(k) || new RegExp(`\\b${k}\\b`).test(t));
}

/**
 * Stage 1: Preprocess raw OCR text
 */
export function preprocessInvoiceText(rawText: string): string[] {
  const text = (rawText ?? '').trim();
  if (!text) return [];

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);

  log('preprocessed lines', lines.length, lines.slice(0, 20));
  return lines;
}

/**
 * Generic item start detection
 */
export function isLikelyItemStart(line: string, nextLine?: string): boolean {
  const t = line.trim();
  if (t.length < 3) return false;

  if (isHeaderFooterLine(line)) return false;

  const repCode = /^[A-Z]{2,4}\d{2,4}$/;
  if (repCode.test(t)) return false;

  // Product lines are usually: SKU code + description + barcode (12-13 digits).
  // Address/header fragments can start with numbers, so we avoid relying on
  // "numbers + letters" heuristics alone.
  // Use digit-only boundaries so we still match barcodes even when they are
  // glued to letters like "...SMALL035585111315...".
  const hasBarcodeLikeNumber = /(?:^|\D)\d{12,13}/.test(t);
  const hasLetter = /[A-Za-z]/.test(t);
  const hasSkuPrefix = /^[A-Z]{1,6}\d{1,8}/.test(t); // e.g. KDT3, KDKP51

  if (hasBarcodeLikeNumber && hasLetter) return true;
  if (hasSkuPrefix && hasLetter) return true;

  // Avoid treating pure short numbers as item blocks.
  if (/^\d{3,10}$/.test(t)) return false;

  return false;
}

function isFooterSection(lines: string[], fromIndex: number): boolean {
  const t = (lines[fromIndex] ?? '').trim().toLowerCase();
  if (/^price \(ex gst\)/i.test(t)) return true;
  if (/^\$?[\d,]+\.\d{2}\s*$/.test(t) && lines[fromIndex - 1]?.toLowerCase().includes('total')) return true;
  if (/^all goods should be checked/i.test(t)) return true;
  if (/^bank details/i.test(t)) return true;
  if (/^total\s*$/i.test(t)) return true;
  return false;
}

/**
 * Stage 2: Group lines into candidate item blocks
 */
export function groupItemBlocks(lines: string[]): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (isFooterSection(lines, i)) break;

    if (isLikelyItemStart(line, lines[i + 1])) {
      if (current.length > 0) {
        blocks.push(current);
        current = [];
      }
      current.push(line);
    } else if (current.length > 0) {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current);

  log('item blocks', blocks.length);
  return blocks;
}

function computeConfidence(item: ParsedInvoiceItemRich): number {
  let c = 0;
  if (item.itemCode) c += 0.3;
  if (item.barcode) c += 0.3;
  if (item.name && item.name !== 'Unknown item' && item.name.length >= 4) c += 0.2;
  if (item.quantityOrdered != null || item.quantityDelivered != null) c += 0.1;
  if (item.unitPrice != null || item.netPrice != null) c += 0.1;
  return Math.min(1, Math.max(0, c));
}

/**
 * Generic barcode extraction: 8-14 digits, exclude dates/totals
 */
export function findLikelyBarcode(text: string): string | null {
  // OCR often glues the barcode digits directly to the following price digits
  // (e.g. "...SMALL035585111315336.62..."). To handle that, detect a
  // 11-14 digit sequence immediately followed by a decimal price.
  //
  // Group 1 is the barcode, Group 2 starts the price (we ignore it).
  // Prefer exact 12-digit barcodes first to avoid greedy partial overlap
  // with the following price digits.
  const collectGroup1 = (re: RegExp): string[] => {
    // Avoid spreading a RegExp iterator (requires downlevelIteration).
    const out: string[] = [];
    const r = new RegExp(re.source, re.flags);
    let m: RegExpExecArray | null = null;
    while ((m = r.exec(text)) !== null) {
      out.push(m[1]);
      // Safety: prevent infinite loops on zero-width matches.
      if (m.index === r.lastIndex) r.lastIndex++;
    }
    return out;
  };

  const matches12 = collectGroup1(/(?:^|\D)(\d{12})(\d{1,4}\.\d{2})/g);
  if (matches12.length > 0) return matches12[0];

  const matches13 = collectGroup1(/(?:^|\D)(\d{13})(\d{1,4}\.\d{2})/g);
  if (matches13.length > 0) return matches13[0];

  // Fallback: any 12-13 digit run.
  const candidates = collectGroup1(/(?:^|\D)(\d{12,13})/g);
  return candidates[0] ?? null;
}

/**
 * Stage 3: Parse each item block
 */
export function parseItemBlock(blockLines: string[]): ParsedInvoiceItemRich | null {
  const rawBlock = blockLines.join('\n');
  const blockText = rawBlock.trim();
  if (!blockText) return null;

  let itemCode: string | null = null;
  let barcode: string | null = null;
  const nameParts: string[] = [];
  let quantityOrdered: number | null = null;
  let quantityDelivered: number | null = null;
  let quantityBackOrder: number | null = null;
  let unitPrice: number | null = null;
  let netPrice: number | null = null;
  let subtotal: number | null = null;
  let unitLabel: string | null = null;

  const firstLine = blockLines[0]?.trim() ?? '';
  if (!firstLine) return null;

  const codeMatch = firstLine.match(/^(\d{3,10})/) ?? firstLine.match(/^([A-Z]{1,5}\d{1,8})/);
  if (codeMatch) itemCode = codeMatch[1];

  barcode = findLikelyBarcode(blockText);
  const numericText = barcode
    ? // Strip the barcode digits so price decimals like "...336.62" don't get
      // matched as a huge "...<barcode><price>.xx" number.
      blockText.replace(new RegExp(escapeRe(barcode), 'g'), ' ')
    : blockText;

  // OCR frequently glues adjacent numeric fields (e.g. "...336.620.00...").
  // Don't require a non-digit after the 2 decimals; capture the decimals anyway
  // and let the block-level filtering choose the right ones.
  const decimals = numericText.match(/\d+\.\d{2}/g);
  if (decimals && decimals.length >= 1) {
    const parsed = decimals.map((d) => parseFloat(d)).filter((n) => !Number.isNaN(n) && n > 0 && n < 100000);
    const sorted = [...parsed].sort((a, b) => a - b);
    // When fields are glued by OCR, the safest assumption is:
    // - unit price and line total are among the largest values present
    // - net price / line total is usually the 2nd-largest number
    unitPrice = sorted[sorted.length - 1] ?? null;
    netPrice = sorted.length >= 2 ? sorted[sorted.length - 2] : unitPrice;
    subtotal = Math.max(...parsed);
  }

  for (const u of UNIT_LABELS) {
    if (new RegExp(`\\b${u}\\b`, 'i').test(blockText)) {
      unitLabel = u.charAt(0).toUpperCase() + u.slice(1).toLowerCase();
      break;
    }
  }

  const qtyMatch = blockText.match(/\b(\d{1,4})\s*(?:Each|Set|Box|Pack)/i);
  if (qtyMatch) quantityDelivered = parseInt(qtyMatch[1], 10) || null;

  for (const line of blockLines) {
    const t = line.trim();
    if (/^\d{1,4}$/.test(t) && quantityDelivered == null) {
      const q = parseInt(t, 10);
      if (q >= 1 && q <= 9999) quantityDelivered = q;
    }
  }

  const nameStr = extractName(blockText, itemCode, barcode);
  const name = nameStr && nameStr.length >= 2 ? nameStr : 'Unknown item';

  const item: ParsedInvoiceItemRich = {
    itemCode,
    barcode,
    name,
    quantityOrdered,
    quantityDelivered,
    quantityBackOrder,
    unitPrice,
    netPrice,
    subtotal,
    unitLabel,
    rawBlock,
    confidence: 0,
  };
  item.confidence = computeConfidence(item);

  const hasRealData =
    itemCode || barcode || (name !== 'Unknown item') || unitPrice != null || netPrice != null || quantityDelivered != null || quantityOrdered != null;

  if (!hasRealData) {
    log('parse failure', { blockLines, reason: 'no usable data' });
    return null;
  }

  log('parsed block', item);
  return item;
}

function extractName(blockText: string, itemCode: string | null, barcode: string | null): string {
  let text = blockText;

  if (itemCode) {
    text = text.replace(new RegExp(`^${escapeRe(itemCode)}`), '');
  }
  if (barcode) {
    text = text.replace(new RegExp(escapeRe(barcode), 'g'), ' ');
  }

  text = text
    .replace(/\d+\.\d{2,}\b/g, ' ')
    .replace(/\b\d{1,4}\s*(?:Each|Set|Box|Pack|Packet)/gi, ' ')
    // Remove barcodes even when adjacent to letters (no whitespace in OCR).
    .replace(/(^|\D)(\d{12,13})/g, '$1 ')
    .replace(/[A-Z]{2,4}\d{2,4}\b/g, ' ')
    .replace(/\d{5,}[\d.]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const cleaned = text.replace(/^\d+\s*/, '').trim();
  if (cleaned.length >= 4 && /[A-Za-z]/.test(cleaned) && !/^\d+\.?\d*$/.test(cleaned)) return cleaned;
  return '';
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function toLegacy(item: ParsedInvoiceItemRich): LegacyParsedItem {
  const quantity = item.quantityDelivered ?? item.quantityOrdered ?? item.quantityBackOrder ?? 1;
  const price = item.netPrice ?? item.unitPrice ?? 0;

  return {
    code: item.barcode ?? item.itemCode ?? null,
    sku: item.barcode ?? null,
    name: item.name,
    quantity: Math.min(Math.max(quantity, 1), 200),
    price: price > 0 ? price : 0.01,
  };
}

/**
 * Main entry: deterministic parse, no AI
 */
export function deterministicParse(rawText: string): { items: LegacyParsedItem[]; richItems: ParsedInvoiceItemRich[] } {
  const lines = preprocessInvoiceText(rawText);
  if (lines.length === 0) return { items: [], richItems: [] };

  const blocks = groupItemBlocks(lines);
  const richItems: ParsedInvoiceItemRich[] = [];

  for (const block of blocks) {
    try {
      const parsed = parseItemBlock(block);
      if (parsed && parsed.name !== 'Product') {
        richItems.push(parsed);
      }
    } catch (err) {
      log('parse failure', { blockLines: block, reason: String(err) });
    }
  }

  const items = richItems.map(toLegacy);
  return { items, richItems };
}
