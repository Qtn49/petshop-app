import type { ParsedInvoiceResult } from './types';
import { regexParser, getCandidateLines } from './regexParser';
import { validateItems } from './validator';
import { fallbackGroq } from './fallbackGroq';

/**
 * Parse invoice text: line-based regex first (candidate lines only), then Groq fallback if
 * validation fails or fewer than 3 items. Fallback receives only candidate lines.
 */
export async function parseInvoiceText(text: string): Promise<ParsedInvoiceResult> {
  const trimmed = text?.trim() ?? '';
  if (!trimmed) {
    return { items: [] };
  }

  const result = regexParser(trimmed);
  const validation = validateItems(result.items);
  const enoughItems = result.items.length >= 3;

  if (validation.valid && enoughItems) {
    return result;
  }

  const candidateLines = getCandidateLines(trimmed);
  const filteredText = candidateLines.length > 0 ? candidateLines.join('\n') : trimmed;
  return fallbackGroq(filteredText);
}

export type { ParsedInvoiceItem, ParsedInvoiceResult } from './types';
export { regexParser, getCandidateLines } from './regexParser';
export { validateItems } from './validator';
export { fallbackGroq } from './fallbackGroq';
