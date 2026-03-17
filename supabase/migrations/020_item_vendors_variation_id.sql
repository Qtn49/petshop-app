-- Switch item_vendors primary key from item_id to variation_id.
-- Square links vendor info at the VARIATION level, not the item level.

ALTER TABLE item_vendors ADD COLUMN IF NOT EXISTS variation_id TEXT;
ALTER TABLE item_vendors ADD COLUMN IF NOT EXISTS vendor_price NUMERIC;
ALTER TABLE item_vendors ADD COLUMN IF NOT EXISTS last_purchase_price NUMERIC;

-- Back-fill variation_id from item_id for any existing rows so the NOT NULL
-- constraint can be applied without data loss.
UPDATE item_vendors SET variation_id = item_id WHERE variation_id IS NULL;

ALTER TABLE item_vendors ALTER COLUMN variation_id SET NOT NULL;

-- Replace the old unique index on item_id with one on variation_id
DROP INDEX IF EXISTS idx_item_vendors_item_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_item_vendors_variation_id ON item_vendors(variation_id);

COMMENT ON TABLE item_vendors IS 'Maps Square catalog variation_id to vendor (id, name, code). Square is catalog source of truth; local DB is vendor-relationship source of truth.';
