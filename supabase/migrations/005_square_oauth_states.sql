-- Square OAuth state table for CSRF protection
CREATE TABLE IF NOT EXISTS square_oauth_states (
  state TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_square_oauth_states_expires ON square_oauth_states(expires_at);
