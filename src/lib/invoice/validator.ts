import type { ParsedInvoiceItem } from './types';

export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: string[] };

/**
 * Validates parsed invoice items.
 * Rules: non-empty array, quantity > 0, price valid number, name at least 2 characters.
 */
export function validateItems(items: ParsedInvoiceItem[]): ValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(items) || items.length === 0) {
    return { valid: false, errors: ['Items array must not be empty'] };
  }

  items.forEach((item, index) => {
    const prefix = `Item ${index + 1}:`;

    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (name.length < 2) {
      errors.push(`${prefix} name must be at least 2 characters`);
    }

    const qty = Number(item.quantity);
    if (Number.isNaN(qty) || qty <= 0) {
      errors.push(`${prefix} quantity must be a number greater than 0`);
    }

    const price = Number(item.price);
    if (Number.isNaN(price) || price < 0) {
      errors.push(`${prefix} price must be a valid non-negative number`);
    }
  });

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}
