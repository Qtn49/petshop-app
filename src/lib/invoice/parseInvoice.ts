import type { ParsedInvoiceResult } from './types';
import { regexParser } from './regexParser';
import { validateItems } from './validator';
import { fallbackAI } from './fallbackAI';

/**
 * Parse invoice text: try regex first, then AI fallback if validation fails.
 * Reduces API usage by parsing locally when possible.
 */
export async function parseInvoiceText(text: string): Promise<ParsedInvoiceResult> {
  const trimmed = text?.trim() ?? '';
  if (!trimmed) {
    return { items: [] };
  }

  const result = regexParser(trimmed);
  const validation = validateItems(result.items);

  if (validation.valid) {
    console.log('Regex parsing success');
    return result;
  }

  console.log('Regex parsing failed, using AI fallback');
  return fallbackAI(trimmed);
}

export type { ParsedInvoiceItem, ParsedInvoiceResult } from './types';
export { regexParser } from './regexParser';
export { validateItems } from './validator';
export { fallbackAI } from './fallbackAI';
