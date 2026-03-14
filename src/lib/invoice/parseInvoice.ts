import type { ParsedInvoiceResult } from './types';
import { csvParser } from './csvParser';
import { deterministicParse } from './deterministicParser';

export type ParseContext = {
  preMatchedBarcodes?: Set<string>;
};

function toParsedInvoiceItems(
  legacy: Array<{ code: string | null; sku: string | null; name: string; quantity: number; price: number }>
): Array<{ code?: string; name: string; quantity: number; price: number }> {
  return legacy.map((l) => ({
    code: l.code ?? l.sku ?? undefined,
    name: l.name,
    quantity: l.quantity,
    price: l.price,
  }));
}

/**
 * Parse invoice text: CSV first (if CSV structure), then deterministic parser.
 * No AI/LLM calls. Regex and heuristics only.
 */
export async function parseInvoiceText(
  text: string,
  context?: ParseContext
): Promise<ParsedInvoiceResult> {
  const trimmed = text?.trim() ?? '';
  if (!trimmed) {
    return { items: [] };
  }

  const csvResult = csvParser(trimmed);
  if (csvResult.items.length >= 1) {
    return withPreMatchedFlags(csvResult, context?.preMatchedBarcodes);
  }

  const { items: detItems } = deterministicParse(trimmed);
  const items = toParsedInvoiceItems(detItems);

  if (items.length > 0) {
    console.log('Deterministic parsing:', items.length, 'items');
    return withPreMatchedFlags({ items }, context?.preMatchedBarcodes);
  }

  return { items: [] };
}

function withPreMatchedFlags(
  result: ParsedInvoiceResult,
  preMatched?: Set<string>
): ParsedInvoiceResult {
  if (!preMatched || preMatched.size === 0) return result;
  return {
    items: result.items.map((item) => ({
      ...item,
      matchedFromHistory: item.code ? preMatched.has(item.code) : false,
    })),
  };
}

export type { ParsedInvoiceItem, ParsedInvoiceResult } from './types';
export { csvParser } from './csvParser';
export { deterministicParse, preprocessInvoiceText, groupItemBlocks, parseItemBlock } from './deterministicParser';
export { verifyParsedItemsWithAI, type VerifyResult } from './verifyWithAI';
