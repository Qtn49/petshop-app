-- Add location and connected_at to square_connections (for existing projects)
ALTER TABLE square_connections ADD COLUMN IF NOT EXISTS location_id TEXT;
ALTER TABLE square_connections ADD COLUMN IF NOT EXISTS location_name TEXT;
ALTER TABLE square_connections ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ DEFAULT NOW();
