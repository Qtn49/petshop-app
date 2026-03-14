/**
 * Single line item parsed from an invoice (legacy format for UI/API).
 */
export type ParsedInvoiceItem = {
  code?: string | null;
  name: string;
  quantity: number;
  price: number;
  /** Set when barcode was found in supplier_products (pre-matched from history) */
  matchedFromHistory?: boolean;
};

/**
 * Result of parsing an invoice (regex or AI).
 */
export type ParsedInvoiceResult = {
  items: ParsedInvoiceItem[];
};
