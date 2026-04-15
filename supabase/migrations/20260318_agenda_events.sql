CREATE TABLE IF NOT EXISTS agenda_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  date date NOT NULL,
  time text,
  location text,
  participants text,
  description text,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE agenda_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access" ON agenda_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert access" ON agenda_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update access" ON agenda_events FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete access" ON agenda_events FOR DELETE TO authenticated USING (true);
