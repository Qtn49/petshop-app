-- Ensure uuid-ossp exists for any legacy usage; migrations use gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
