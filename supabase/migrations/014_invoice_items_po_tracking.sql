-- Mark invoice items that have been added to a purchase order
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS in_purchase_order BOOLEAN NOT NULL DEFAULT FALSE;

-- Link purchase order lines back to invoice items
ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS invoice_item_id UUID REFERENCES invoice_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoice_items_in_po ON invoice_items(invoice_id) WHERE in_purchase_order = TRUE;
CREATE INDEX IF NOT EXISTS idx_purchase_order_lines_invoice_item ON purchase_order_lines(invoice_item_id);
