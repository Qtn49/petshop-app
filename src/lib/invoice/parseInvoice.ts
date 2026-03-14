import type { ParsedInvoiceResult } from './types';
import { csvParser } from './csvParser';
import { kongParser } from './kongParser';
import { regexParser, getCandidateLines } from './regexParser';
import { validateItems } from './validator';
import { fallbackGroq, type KnownProduct } from './fallbackGroq';

export type ParseContext = {
  knownProducts?: KnownProduct[];
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
 * Parse invoice text: CSV first (if CSV structure), then Kong parser (Kong-style invoices),
 * then regex fallback, then Groq AI fallback.
 * Optional context: knownProducts, preMatchedBarcodes for learning.
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

  const kongResult = kongParser(trimmed);
  if (kongResult.items.length >= 2) {
    const items = toParsedInvoiceItems(kongResult.items);
    const validation = validateItems(items);
    if (validation.valid || kongResult.items.length >= 5) {
      console.log('Kong parsing success:', kongResult.items.length, 'items');
      return withPreMatchedFlags({ items }, context?.preMatchedBarcodes);
    }
  }

  const result = regexParser(trimmed);
  const validation = validateItems(result.items);
  const enoughItems = result.items.length >= 2;

  if (validation.valid && enoughItems) {
    console.log('Regex parsing success');
    return withPreMatchedFlags(result, context?.preMatchedBarcodes);
  }

  console.log('Regex/Kong parsing failed or fewer than 2 valid items, using Groq fallback');
  const candidateLines = getCandidateLines(trimmed);
  const filteredText = candidateLines.length > 0 ? candidateLines.join('\n') : trimmed;
  const groqResult = await fallbackGroq(filteredText, context?.knownProducts);
  return withPreMatchedFlags(groqResult, context?.preMatchedBarcodes);
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
export { regexParser, getCandidateLines } from './regexParser';
export { validateItems } from './validator';
export { fallbackGroq } from './fallbackGroq';
