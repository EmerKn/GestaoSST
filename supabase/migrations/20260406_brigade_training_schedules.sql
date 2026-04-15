CREATE TABLE IF NOT EXISTS brigade_training_schedules (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  observations TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
