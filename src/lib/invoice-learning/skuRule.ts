/**
 * SKU rule: 8 to 12 digits, digits only.
 * Regex: /\b\d{8,12}\b/
 */
export const SKU_REGEX = /\b\d{8,12}\b/g;

export function extractBarcodes(text: string): string[] {
  const matches = (text ?? '').match(SKU_REGEX) ?? [];
  return Array.from(new Set(matches));
}

export function isValidSku(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false;
  return /^\d{8,12}$/.test(value.trim());
}
