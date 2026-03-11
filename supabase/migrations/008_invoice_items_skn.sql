-- Add SKN (product code) column to invoice_items for editable code after parsing
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS skn TEXT;
