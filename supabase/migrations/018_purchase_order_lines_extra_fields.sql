-- Store optional/dynamic Square fields per purchase order line (environment-specific)
ALTER TABLE purchase_order_lines
  ADD COLUMN IF NOT EXISTS extra_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN purchase_order_lines.extra_fields IS 'Optional Square fields: description, category, retail_price, vendor, vendor_code, barcode, custom attributes, etc.';
