import type { ParsedInvoiceItem, ParsedInvoiceResult } from './types';

const GROQ_BASE = 'https://api.groq.com/openai/v1';
const GROQ_MODEL = 'llama-3.1-8b-instant';

const BASE_EXTRACT_PROMPT = `Extract product items from these invoice lines.
Ignore totals, freight, tax, bank details and phone numbers.
Return JSON array with fields:
code, name, quantity, price.`;

const KNOWN_PRODUCTS_PREFIX = `This supplier has previously sent invoices containing the following products (barcode → product name). Use this information when parsing the invoice.

`;

/** Same as regexParser: lines with dollar price + digit before price. */
const CANDIDATE_LINE_TEST = /\d+\s*\$?\s*\d+\.\d{2}/;

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

function isValidItem(item: ParsedInvoiceItem): boolean {
  const name = item.name.trim();
  if (name.length < 4) return false;
  const nameLower = name.toLowerCase();
  if (INVALID_KEYWORDS.some((k) => nameLower.includes(k))) return false;
  if (item.quantity <= 0 || item.quantity > 200) return false;
  if (item.price <= 0) return false;
  const code = (item.code ?? '').trim();
  if (code.length > 0 && code.length < 5) return false;
  return true;
}

function normalizeItem(raw: unknown): ParsedInvoiceItem {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const name = String(o.name ?? o.product_name ?? o.description ?? '').trim() || 'Unknown';
  const code = o.code != null ? String(o.code).trim() : undefined;
  const quantity = Math.max(1, Math.min(200, Number(o.quantity) || 1));
  const price = Math.max(0, Number(o.price) || 0);
  return { code: code || undefined, name, quantity, price };
}

export type KnownProduct = { barcode: string; name: string };

/**
 * Fallback parser using Groq API when regex parsing fails or yields fewer than 3 items.
 * Sends only candidate product lines (dollar price + digit before price). Returns normalized items.
 * Optionally inject known supplier products into the prompt to improve extraction.
 */
export async function fallbackGroq(
  text: string,
  knownProducts?: KnownProduct[]
): Promise<ParsedInvoiceResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not set. Set it for invoice fallback parsing.');
  }

  const candidateLines = (text ?? '')
    .split(/\r?\n/)
    .filter((line) => CANDIDATE_LINE_TEST.test(line));
  const filteredText = candidateLines.length > 0 ? candidateLines.join('\n') : text;
  const body = (filteredText ?? '').slice(0, 8000);

  let systemPrompt = BASE_EXTRACT_PROMPT;
  if (knownProducts && knownProducts.length > 0) {
    const mapping = knownProducts
      .map((p) => `${p.barcode} → ${p.name}`)
      .join('\n');
    systemPrompt = KNOWN_PRODUCTS_PREFIX + mapping + '\n\n' + BASE_EXTRACT_PROMPT;
  }

  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: body },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No content in Groq response');

  const parsed = JSON.parse(content) as { items?: unknown[]; [k: string]: unknown };
  const rawItems: unknown[] = Array.isArray(parsed.items)
    ? parsed.items
    : Array.isArray(parsed)
      ? parsed
      : [];

  const items: ParsedInvoiceItem[] = rawItems
    .map(normalizeItem)
    .filter(isValidItem);

  return { items };
}
