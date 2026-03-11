import type { ParsedInvoiceItem, ParsedInvoiceResult } from './types';

/**
 * Regex-based parser for common invoice line patterns.
 * Handles formats like:
 * - "2 Dog Food 20.00"
 * - "1 Cat Toy 5.50"
 * - "Dog Food x2 $20"
 * - "2x Dog Food $20"
 */
export function regexParser(text: string): ParsedInvoiceResult {
  const items: ParsedInvoiceItem[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const item = parseLine(line);
    if (item) items.push(item);
  }

  return { items };
}

function parseLine(line: string): ParsedInvoiceItem | null {
  // Pattern: "2 Dog Food 20.00" or "2  Dog Food  20.00" — quantity at start, price at end
  const qtyFirst = line.match(
    /^(\d+)\s+(.+?)\s+(\d+(?:\.\d{1,2})?)\s*$/
  );
  if (qtyFirst) {
    const [, qty, name, price] = qtyFirst;
    const n = name.trim();
    if (n.length >= 2) {
      return {
        name: n,
        quantity: parseInt(qty!, 10) || 1,
        price: parseFloat(price!),
      };
    }
  }

  // Pattern: "Dog Food x2 $20" or "Dog Food x 2 $20.00"
  const nameXQtyPrice = line.match(
    /^(.+?)\s+x\s*(\d+)\s+\$?\s*(\d+(?:\.\d{1,2})?)\s*$/i
  );
  if (nameXQtyPrice) {
    const [, name, qty, price] = nameXQtyPrice;
    const n = name.trim();
    if (n.length >= 2) {
      return {
        name: n,
        quantity: parseInt(qty!, 10) || 1,
        price: parseFloat(price!),
      };
    }
  }

  // Pattern: "2x Dog Food $20" or "2x Dog Food 20.00"
  const qtyXNamePrice = line.match(
    /^(\d+)\s*x\s+(.+?)\s+\$?\s*(\d+(?:\.\d{1,2})?)\s*$/i
  );
  if (qtyXNamePrice) {
    const [, qty, name, price] = qtyXNamePrice;
    const n = name.trim();
    if (n.length >= 2) {
      return {
        name: n,
        quantity: parseInt(qty!, 10) || 1,
        price: parseFloat(price!),
      };
    }
  }

  // Pattern: "Dog Food  2  20.00" — name, then quantity, then price (spaces)
  const nameQtyPrice = line.match(
    /^(.+?)\s+(\d+)\s+(\d+(?:\.\d{1,2})?)\s*$/
  );
  if (nameQtyPrice) {
    const [, name, qty, price] = nameQtyPrice;
    const n = name.trim();
    if (n.length >= 2 && !/^\d+$/.test(n)) {
      return {
        name: n,
        quantity: parseInt(qty!, 10) || 1,
        price: parseFloat(price!),
      };
    }
  }

  // Pattern: "$20.00  2  Dog Food" — price first (optional $)
  const priceQtyName = line.match(
    /^\$?\s*(\d+(?:\.\d{1,2})?)\s+(\d+)\s+(.+?)\s*$/
  );
  if (priceQtyName) {
    const [, price, qty, name] = priceQtyName;
    const n = name.trim();
    if (n.length >= 2 && !/^\d+$/.test(n)) {
      return {
        name: n,
        quantity: parseInt(qty!, 10) || 1,
        price: parseFloat(price!),
      };
    }
  }

  return null;
}
