-- Local vendor-to-item mapping (Square does not link vendors to catalog items)
CREATE TABLE IF NOT EXISTS item_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id TEXT NOT NULL,
  vendor_id TEXT,
  vendor_name TEXT NOT NULL DEFAULT '',
  vendor_code TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_item_vendors_item_id ON item_vendors(item_id);
COMMENT ON TABLE item_vendors IS 'Maps Square catalog item_id to Square vendor (id, name) and supplier vendor_code; stored locally.';
