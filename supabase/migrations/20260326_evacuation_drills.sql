CREATE TABLE IF NOT EXISTS evacuation_drills (
  id SERIAL PRIMARY KEY,
  date TEXT,
  start_time TEXT,
  end_time TEXT,
  total_duration TEXT,
  shift TEXT,
  location TEXT,
  simulation_description TEXT,
  emergency_response TEXT,
  strong_points TEXT,
  improvement_points TEXT,
  brigade_members JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
