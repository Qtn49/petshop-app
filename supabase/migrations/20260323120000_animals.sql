CREATE TABLE IF NOT EXISTS animals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  species TEXT NOT NULL CHECK (species IN ('cat','kitten','bird','dog','rabbit','reptile','other')),
  breed TEXT,
  age_months INTEGER,
  sex TEXT CHECK (sex IN ('male','female','unknown')),
  price DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','adopted','reserved')),
  hand_raised BOOLEAN DEFAULT NULL,
  microchipped BOOLEAN DEFAULT FALSE,
  vaccinated BOOLEAN DEFAULT FALSE,
  notes TEXT,
  photos TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, slug)
);
CREATE INDEX idx_animals_org ON animals(organization_id);
CREATE INDEX idx_animals_status ON animals(organization_id, status);
CREATE INDEX idx_animals_species ON animals(organization_id, species);

INSERT INTO storage.buckets (id, name, public)
VALUES ('animals', 'animals', true)
ON CONFLICT (id) DO NOTHING;
