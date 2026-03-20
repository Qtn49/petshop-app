-- PO-level fields for purchase order CSV (from invoice parsing)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS po_vendor_name TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS po_ship_to TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS po_expected_on TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS po_notes TEXT;
