-- User-defined invoice calculated price formulas (label + formula in %)
CREATE TABLE IF NOT EXISTS invoice_formula_presets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  formula_percent TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_formula_presets_user ON invoice_formula_presets(user_id);
