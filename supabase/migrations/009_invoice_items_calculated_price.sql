-- Add calculated price column (markup formula result or user override)
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS calculated_price DECIMAL(10, 2);
