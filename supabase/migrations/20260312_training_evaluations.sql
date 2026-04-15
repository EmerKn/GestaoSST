ALTER TABLE trainings ADD COLUMN IF NOT EXISTS workload INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS training_evaluations (
  id SERIAL PRIMARY KEY,
  training_id INTEGER REFERENCES trainings(id) ON DELETE CASCADE,
  evaluator_type TEXT,
  evaluator_name TEXT,
  rating_instructor INTEGER,
  rating_content INTEGER,
  rating_vocabulary INTEGER,
  rating_location INTEGER,
  rating_time INTEGER,
  photo_url TEXT,
  comments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
