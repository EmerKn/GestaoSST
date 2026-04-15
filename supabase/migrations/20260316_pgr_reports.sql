CREATE TABLE IF NOT EXISTS pgr_reports (
  id SERIAL PRIMARY KEY,
  year INTEGER NOT NULL,
  title TEXT NOT NULL,
  file_url TEXT,
  summary TEXT,
  risks_by_sector JSONB,
  top_5_risks JSONB,
  action_plan TEXT,
  suggestions TEXT,
  norms TEXT,
  raw_analysis TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
