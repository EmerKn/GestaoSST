ALTER TABLE ppes ADD COLUMN IF NOT EXISTS validity_date TEXT;
ALTER TABLE ppes ADD COLUMN IF NOT EXISTS validity_months INTEGER DEFAULT 12;

CREATE TABLE IF NOT EXISTS ppe_movements (
  id SERIAL PRIMARY KEY,
  ppe_id INTEGER REFERENCES ppes(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  type TEXT NOT NULL, -- 'entrada' or 'saida'
  quantity INTEGER NOT NULL,
  date TEXT NOT NULL,
  reason TEXT
);
