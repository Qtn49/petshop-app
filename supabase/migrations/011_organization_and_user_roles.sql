-- Organization (company) for first-launch detection and settings
CREATE TABLE IF NOT EXISTS organization (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT NOT NULL,
  address TEXT,
  email TEXT,
  phone TEXT,
  currency TEXT NOT NULL DEFAULT 'AUD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add role to users (admin | staff) for onboarding and access control
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'staff'
      CHECK (role IN ('admin', 'staff'));
  END IF;
END $$;

-- Ensure at least one admin: existing single user becomes admin (optional, run once)
-- Uncomment if you want to promote existing users:
-- UPDATE users SET role = 'admin' WHERE id = (SELECT id FROM users LIMIT 1);
