-- Aquariums v2: water groups, parameters, name-based slugs

-- 1. Create water_groups table first (tanks will reference it)
CREATE TABLE water_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_water_groups_user_id ON water_groups(user_id);

-- 2. Add new columns to tanks (aquarium table)
-- Drop existing slug if it was added as generated column (from chatbot migration)
ALTER TABLE tanks DROP COLUMN IF EXISTS slug;

ALTER TABLE tanks ADD COLUMN IF NOT EXISTS water_group_id UUID REFERENCES water_groups(id) ON DELETE SET NULL;
ALTER TABLE tanks ADD COLUMN IF NOT EXISTS temperature DECIMAL(4,1);
ALTER TABLE tanks ADD COLUMN IF NOT EXISTS ph DECIMAL(3,1);
ALTER TABLE tanks ADD COLUMN IF NOT EXISTS last_cleaned_at DATE;
-- notes already exists in tanks, skip

-- 3. Add slug column (name-based, lowercase, spaces to dashes)
ALTER TABLE tanks ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Backfill slug for existing rows
UPDATE tanks
SET slug = sub.slug
FROM (
  SELECT
    id,
    CASE
      WHEN rn > 1 THEN base_slug || '-' || LEFT(id::text, 8)
      ELSE base_slug
    END AS slug
  FROM (
    SELECT
      id,
      LOWER(REGEXP_REPLACE(TRIM(COALESCE(name, 'tank')), '\s+', '-', 'g')) AS base_slug,
      ROW_NUMBER() OVER (
        PARTITION BY LOWER(REGEXP_REPLACE(TRIM(COALESCE(name, 'tank')), '\s+', '-', 'g'))
        ORDER BY created_at, id
      ) AS rn
    FROM tanks
  ) inner_sub
) sub
WHERE tanks.id = sub.id AND (tanks.slug IS NULL OR tanks.slug = '');

-- Ensure unique constraint exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tanks_slug_key') THEN
    ALTER TABLE tanks ADD CONSTRAINT tanks_slug_key UNIQUE (slug);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tanks_water_group_id ON tanks(water_group_id);
