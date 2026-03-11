-- Add redirect_uri to square_oauth_states so we can use request origin (e.g. ngrok) instead of env
ALTER TABLE square_oauth_states ADD COLUMN IF NOT EXISTS redirect_uri TEXT;
