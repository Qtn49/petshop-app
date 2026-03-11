import type { ParsedInvoiceResult } from './types';
import { csvParser } from './csvParser';
import { regexParser, getCandidateLines } from './regexParser';
import { validateItems } from './validator';
import { fallbackGroq } from './fallbackGroq';

/**
 * Parse invoice text: CSV parser first (if CSV structure detected), then line-based regex,
 * then Groq fallback if validation fails or fewer than 3 items. Existing regex and Groq logic unchanged.
 */
export async function parseInvoiceText(text: string): Promise<ParsedInvoiceResult> {
  const trimmed = text?.trim() ?? '';
  if (!trimmed) {
    return { items: [] };
  }

  const csvResult = csvParser(trimmed);
  if (csvResult.items.length >= 1) {
    return csvResult;
  }

  const result = regexParser(trimmed);
  const validation = validateItems(result.items);
  const enoughItems = result.items.length >= 3;

  if (validation.valid && enoughItems) {
    console.log('Regex parsing success');
    return result;
  }

  console.log('Regex parsing failed or fewer than 3 items, using Groq fallback');
  const candidateLines = getCandidateLines(trimmed);
  const filteredText = candidateLines.length > 0 ? candidateLines.join('\n') : trimmed;
  return fallbackGroq(filteredText);
}

export type { ParsedInvoiceItem, ParsedInvoiceResult } from './types';
export { csvParser } from './csvParser';
export { regexParser, getCandidateLines } from './regexParser';
export { validateItems } from './validator';
export { fallbackGroq } from './fallbackGroq';
