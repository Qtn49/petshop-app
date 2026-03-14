-- Allow invoice items to indicate they were pre-matched from supplier history
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS matched_from_supplier_history BOOLEAN NOT NULL DEFAULT FALSE;
