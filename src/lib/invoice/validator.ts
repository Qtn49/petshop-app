import type { ParsedInvoiceItem } from './types';

export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: string[] };

/**
 * Validates parsed invoice items.
 * Rules: at least 2 items, name >= 5 chars, quantity in 1..200, price > 0.
 */
export function validateItems(items: ParsedInvoiceItem[]): ValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(items) || items.length === 0) {
    return { valid: false, errors: ['Items array must not be empty'] };
  }

  if (items.length < 2) {
    return { valid: false, errors: ['At least 2 items required to consider parsing successful'] };
  }

  items.forEach((item, index) => {
    const prefix = `Item ${index + 1}:`;

    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (name.length < 5) {
      errors.push(`${prefix} name must be at least 5 characters`);
    }

    const qty = Number(item.quantity);
    if (Number.isNaN(qty) || qty <= 0 || qty > 200) {
      errors.push(`${prefix} quantity must be between 1 and 200`);
    }

    const price = Number(item.price);
    if (Number.isNaN(price) || price <= 0) {
      errors.push(`${prefix} price must be greater than 0`);
    }
  });

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}
