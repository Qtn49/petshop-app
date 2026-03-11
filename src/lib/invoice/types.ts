/**
 * Single line item parsed from an invoice.
 */
export type ParsedInvoiceItem = {
  code?: string;
  name: string;
  quantity: number;
  price: number;
};

/**
 * Result of parsing an invoice (regex or AI).
 */
export type ParsedInvoiceResult = {
  items: ParsedInvoiceItem[];
};
