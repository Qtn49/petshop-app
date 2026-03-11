-- Ensure square_connections has connected_at and updated_at (required for Square OAuth save)
ALTER TABLE square_connections ADD COLUMN IF NOT EXISTS location_id TEXT;
ALTER TABLE square_connections ADD COLUMN IF NOT EXISTS location_name TEXT;
ALTER TABLE square_connections ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE square_connections ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
