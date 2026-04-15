CREATE TABLE IF NOT EXISTS laudos (
  id SERIAL PRIMARY KEY,
  year INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  actions_by_sector_function JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
