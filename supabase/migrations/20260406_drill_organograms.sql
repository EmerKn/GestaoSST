CREATE TABLE IF NOT EXISTS drill_organograms (
  id SERIAL PRIMARY KEY,
  drill_id INTEGER REFERENCES evacuation_drills(id) ON DELETE CASCADE,
  roles JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
