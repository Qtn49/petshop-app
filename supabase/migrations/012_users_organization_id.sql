-- Add organization_id to users: each user belongs to exactly one organization
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organization(id) ON DELETE CASCADE;

-- Backfill: assign existing users to the single existing organization (if any)
UPDATE users u
SET organization_id = (SELECT id FROM organization LIMIT 1)
WHERE u.organization_id IS NULL AND EXISTS (SELECT 1 FROM organization LIMIT 1);

-- Enforce NOT NULL (only if column exists and we have no nulls left)
DO $$
BEGIN
  ALTER TABLE users ALTER COLUMN organization_id SET NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- Unique constraint: same name cannot exist twice in the same organization
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_org_name_unique;
ALTER TABLE users ADD CONSTRAINT users_org_name_unique UNIQUE (organization_id, name);

CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
