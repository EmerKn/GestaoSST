CREATE TABLE IF NOT EXISTS work_permits (
  id SERIAL PRIMARY KEY,
  permit_number TEXT UNIQUE NOT NULL,
  activity_type TEXT NOT NULL,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  sector TEXT,
  date TEXT,
  start_time TEXT,
  end_time TEXT,
  location TEXT,
  description TEXT,
  hazards TEXT,
  precautions TEXT,
  photo_url TEXT,
  status TEXT DEFAULT 'Ativa',
  responsible_name TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
