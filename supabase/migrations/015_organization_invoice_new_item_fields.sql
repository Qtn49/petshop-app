-- Which optional fields to show when creating a new product from an invoice (Step 3).
-- Values come from Square: built-in (category, retail_price, sku, description, image) + custom attribute definition keys.
ALTER TABLE organization
  ADD COLUMN IF NOT EXISTS invoice_new_item_fields JSONB NOT NULL
  DEFAULT '["category","retail_price","sku","description","image"]'::jsonb;

COMMENT ON COLUMN organization.invoice_new_item_fields IS 'Square item fields to show on invoice confirm (new product form). Built-in: category, retail_price, sku, description, image; plus custom attribute keys from Square.';
