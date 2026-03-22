-- Multitenant: organization slug + sku_mapping

-- 1) Organization slug (unique after backfill)
ALTER TABLE organization ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2) SKU ↔ vendor mapping per organization
CREATE TABLE IF NOT EXISTS sku_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE,
  vendor_code TEXT NOT NULL,
  sku TEXT,
  vendor_name TEXT,
  product_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sku_mapping_org ON sku_mapping(organization_id);
CREATE INDEX IF NOT EXISTS idx_sku_mapping_vendor_code ON sku_mapping(organization_id, vendor_code);
CREATE INDEX IF NOT EXISTS idx_sku_mapping_sku ON sku_mapping(organization_id, sku);

-- 3) Backfill slugs: lowercase, spaces → dashes, strip special chars
--    e.g. "Chinchilla Pet & Equine" → "chinchilla-pet-equine"
UPDATE organization
SET slug = lower(
  regexp_replace(
    regexp_replace(company_name, '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+',
    '-',
    'g'
  )
)
WHERE slug IS NULL;

-- Empty / whitespace-only slugs → deterministic fallback
UPDATE organization
SET slug = 'org-' || left(replace(id::text, '-', ''), 12)
WHERE slug IS NULL OR btrim(slug) = '';

-- Resolve duplicate slugs (keep first row per slug by created_at, id)
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY slug
      ORDER BY created_at NULLS LAST, id
    ) AS rn
  FROM organization
)
UPDATE organization o
SET slug = o.slug || '-' || left(replace(o.id::text, '-', ''), 8)
FROM ranked r
WHERE o.id = r.id
  AND r.rn > 1;

-- Enforce uniqueness (equivalent to slug TEXT UNIQUE)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organization_slug_key'
  ) THEN
    ALTER TABLE organization ADD CONSTRAINT organization_slug_key UNIQUE (slug);
  END IF;
END $$;
