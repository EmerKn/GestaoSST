CREATE TABLE IF NOT EXISTS pcmso_exams (
  id SERIAL PRIMARY KEY,
  exam_name TEXT NOT NULL,
  function_name TEXT NOT NULL,
  sector TEXT NOT NULL,
  periodicity TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
