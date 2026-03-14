-- Invoice learning system: suppliers, invoice_history, supplier_products
-- Suppliers (per organization, detected from invoice header)
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

-- Invoice history: store AI prediction and user correction (never overwrite AI)
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS raw_text TEXT,
  ADD COLUMN IF NOT EXISTS ai_prediction_json JSONB;

CREATE TABLE IF NOT EXISTS invoice_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  raw_text TEXT NOT NULL,
  ai_prediction_json JSONB NOT NULL,
  user_corrected_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learned product mappings per supplier
CREATE TABLE IF NOT EXISTS supplier_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_product_name TEXT NOT NULL,
  barcode TEXT NOT NULL,
  square_variation_id TEXT,
  last_price DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (supplier_id, barcode)
);

CREATE INDEX IF NOT EXISTS idx_supplier_products_barcode ON supplier_products(supplier_id, barcode);
CREATE INDEX IF NOT EXISTS idx_invoice_history_supplier ON invoice_history(supplier_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_org ON suppliers(organization_id);
