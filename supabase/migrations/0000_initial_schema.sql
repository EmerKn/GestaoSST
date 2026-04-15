CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  cpf TEXT,
  role TEXT,
  sector TEXT,
  shift TEXT,
  photo_url TEXT,
  admission_date TEXT,
  gender TEXT DEFAULT 'Masculino'
);

CREATE TABLE IF NOT EXISTS ppes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  ca TEXT,
  price REAL,
  photo_url TEXT,
  stock INTEGER DEFAULT 0,
  last_purchase_date TEXT
);

CREATE TABLE IF NOT EXISTS ppe_deliveries (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  ppe_id INTEGER REFERENCES ppes(id) ON DELETE CASCADE,
  delivery_date TEXT,
  quantity INTEGER
);

CREATE TABLE IF NOT EXISTS fire_equipment (
  id SERIAL PRIMARY KEY,
  type TEXT,
  location TEXT,
  next_inspection TEXT,
  hydrostatic_test TEXT,
  status TEXT,
  sector TEXT,
  quantity INTEGER DEFAULT 1,
  photo_url TEXT,
  equipment_number TEXT
);

CREATE TABLE IF NOT EXISTS brigade_members (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  brigade_role TEXT
);

CREATE TABLE IF NOT EXISTS incidents (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  date TEXT,
  description TEXT,
  type TEXT
);

CREATE TABLE IF NOT EXISTS trainings (
  id SERIAL PRIMARY KEY,
  name TEXT,
  date TEXT,
  instructor TEXT
);

CREATE TABLE IF NOT EXISTS employee_trainings (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  training_id INTEGER REFERENCES trainings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inspection_nr10 (
  id SERIAL PRIMARY KEY,
  date TEXT,
  inspector TEXT,
  sector TEXT,
  panel_condition TEXT,
  grounding TEXT,
  signaling TEXT,
  photo_location TEXT,
  photo_nonconformity TEXT,
  observations TEXT,
  tech_signature TEXT,
  tech_name TEXT,
  tech_role TEXT,
  inspected_signature TEXT,
  inspected_name TEXT,
  inspected_role TEXT
);

CREATE TABLE IF NOT EXISTS inspection_nr12 (
  id SERIAL PRIMARY KEY,
  date TEXT,
  inspector TEXT,
  machine_name TEXT,
  emergency_button TEXT,
  safety_guards TEXT,
  interlock_system TEXT,
  photo_location TEXT,
  photo_nonconformity TEXT,
  observations TEXT,
  tech_signature TEXT,
  tech_name TEXT,
  tech_role TEXT,
  inspected_signature TEXT,
  inspected_name TEXT,
  inspected_role TEXT
);

CREATE TABLE IF NOT EXISTS inspection_nr24 (
  id SERIAL PRIMARY KEY,
  date TEXT,
  inspector TEXT,
  location TEXT,
  cleanliness TEXT,
  lockers_condition TEXT,
  showers_condition TEXT,
  photo_location TEXT,
  photo_nonconformity TEXT,
  observations TEXT,
  tech_signature TEXT,
  tech_name TEXT,
  tech_role TEXT,
  inspected_signature TEXT,
  inspected_name TEXT,
  inspected_role TEXT
);

CREATE TABLE IF NOT EXISTS inspection_nr35 (
  id SERIAL PRIMARY KEY,
  date TEXT,
  inspector TEXT,
  location TEXT,
  anchor_points TEXT,
  lifelines TEXT,
  harnesses TEXT,
  photo_location TEXT,
  photo_nonconformity TEXT,
  observations TEXT,
  tech_signature TEXT,
  tech_name TEXT,
  tech_role TEXT,
  inspected_signature TEXT,
  inspected_name TEXT,
  inspected_role TEXT
);

CREATE TABLE IF NOT EXISTS inspection_nr6 (
  id SERIAL PRIMARY KEY,
  date TEXT,
  inspector TEXT,
  sector TEXT,
  employee_name TEXT,
  ppes_list TEXT,
  ppe_condition TEXT,
  ca_validity TEXT,
  proper_usage TEXT,
  photo_location TEXT,
  photo_nonconformity TEXT,
  observations TEXT,
  tech_signature TEXT,
  tech_name TEXT,
  tech_role TEXT,
  inspected_signature TEXT,
  inspected_name TEXT,
  inspected_role TEXT
);

CREATE TABLE IF NOT EXISTS inspection_5s (
  id SERIAL PRIMARY KEY,
  date TEXT,
  inspector TEXT,
  sector TEXT,
  leader TEXT,
  item1 INTEGER,
  item2 INTEGER,
  item3 INTEGER,
  item4 INTEGER,
  item5 INTEGER,
  item6 INTEGER,
  item7 INTEGER,
  item8 INTEGER,
  item9 INTEGER,
  item10 INTEGER,
  item11 INTEGER,
  item12 INTEGER,
  total_score REAL,
  photo_location TEXT,
  photo_nonconformity TEXT,
  observations TEXT,
  tech_signature TEXT,
  tech_name TEXT,
  tech_role TEXT,
  inspected_signature TEXT,
  inspected_name TEXT,
  inspected_role TEXT
);

CREATE TABLE IF NOT EXISTS inspection_fire (
  id SERIAL PRIMARY KEY,
  date TEXT,
  inspector TEXT,
  sector TEXT,
  equipment_type TEXT,
  equipment_condition TEXT,
  signaling TEXT,
  unobstructed TEXT,
  photo_location TEXT,
  photo_nonconformity TEXT,
  observations TEXT,
  tech_signature TEXT,
  tech_name TEXT,
  tech_role TEXT,
  inspected_signature TEXT,
  inspected_name TEXT,
  inspected_role TEXT,
  equipment_number TEXT,
  photo_extra_1 TEXT,
  photo_extra_2 TEXT
);

CREATE TABLE IF NOT EXISTS inspection_empilhadeira_combustao (
  id SERIAL PRIMARY KEY,
  date TEXT,
  inspector TEXT,
  sector TEXT,
  equipment_name TEXT,
  brakes TEXT,
  tires TEXT,
  lights TEXT,
  horn TEXT,
  seatbelt TEXT,
  fluids TEXT,
  photo_location TEXT,
  photo_nonconformity TEXT,
  observations TEXT,
  tech_signature TEXT,
  tech_name TEXT,
  tech_role TEXT,
  inspected_signature TEXT,
  inspected_name TEXT,
  inspected_role TEXT
);

CREATE TABLE IF NOT EXISTS inspection_empilhadeira_eletrica (
  id SERIAL PRIMARY KEY,
  date TEXT,
  inspector TEXT,
  sector TEXT,
  equipment_name TEXT,
  brakes TEXT,
  tires TEXT,
  lights TEXT,
  horn TEXT,
  seatbelt TEXT,
  battery TEXT,
  photo_location TEXT,
  photo_nonconformity TEXT,
  observations TEXT,
  tech_signature TEXT,
  tech_name TEXT,
  tech_role TEXT,
  inspected_signature TEXT,
  inspected_name TEXT,
  inspected_role TEXT
);

CREATE TABLE IF NOT EXISTS inspection_esmerilhadeira (
  id SERIAL PRIMARY KEY,
  date TEXT,
  inspector TEXT,
  sector TEXT,
  equipment_name TEXT,
  casing TEXT,
  cable TEXT,
  disc TEXT,
  handle TEXT,
  plug TEXT,
  photo_location TEXT,
  photo_nonconformity TEXT,
  observations TEXT,
  tech_signature TEXT,
  tech_name TEXT,
  tech_role TEXT,
  inspected_signature TEXT,
  inspected_name TEXT,
  inspected_role TEXT
);

CREATE TABLE IF NOT EXISTS inspection_solda_mig (
  id SERIAL PRIMARY KEY,
  date TEXT,
  inspector TEXT,
  sector TEXT,
  equipment_name TEXT,
  cables TEXT,
  torch TEXT,
  gas_cylinder TEXT,
  regulator TEXT,
  ground_clamp TEXT,
  photo_location TEXT,
  photo_nonconformity TEXT,
  observations TEXT,
  tech_signature TEXT,
  tech_name TEXT,
  tech_role TEXT,
  inspected_signature TEXT,
  inspected_name TEXT,
  inspected_role TEXT
);

CREATE TABLE IF NOT EXISTS inspection_solda_eletrica (
  id SERIAL PRIMARY KEY,
  date TEXT,
  inspector TEXT,
  sector TEXT,
  equipment_name TEXT,
  cables TEXT,
  electrode_holder TEXT,
  ground_clamp TEXT,
  plug TEXT,
  photo_location TEXT,
  photo_nonconformity TEXT,
  observations TEXT,
  tech_signature TEXT,
  tech_name TEXT,
  tech_role TEXT,
  inspected_signature TEXT,
  inspected_name TEXT,
  inspected_role TEXT
);

CREATE TABLE IF NOT EXISTS inspection_mecanicos (
  id SERIAL PRIMARY KEY,
  date TEXT,
  inspector TEXT,
  sector TEXT,
  employee_name TEXT,
  hand_tools TEXT,
  pneumatic_tools TEXT,
  hoists TEXT,
  ppe_usage TEXT,
  organization TEXT,
  photo_location TEXT,
  photo_nonconformity TEXT,
  observations TEXT,
  tech_signature TEXT,
  tech_name TEXT,
  tech_role TEXT,
  inspected_signature TEXT,
  inspected_name TEXT,
  inspected_role TEXT
);

CREATE TABLE IF NOT EXISTS evacuation_tests (
  id SERIAL PRIMARY KEY,
  date TEXT,
  next_test TEXT,
  status TEXT,
  observations TEXT,
  photo_url TEXT
);

CREATE TABLE IF NOT EXISTS company_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  company_name TEXT,
  company_logo TEXT,
  company_address TEXT,
  company_phone TEXT,
  company_website TEXT,
  resp_name TEXT,
  resp_role TEXT,
  resp_signature TEXT,
  resp_email TEXT,
  sector_colors TEXT
);

CREATE TABLE IF NOT EXISTS cipa_members (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  cipa_role TEXT
);

CREATE TABLE IF NOT EXISTS cipa_meetings (
  id SERIAL PRIMARY KEY,
  date TEXT,
  type TEXT,
  file_url TEXT
);

CREATE TABLE IF NOT EXISTS cipa_meeting_participants (
  id SERIAL PRIMARY KEY,
  meeting_id INTEGER REFERENCES cipa_meetings(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  signature TEXT
);

CREATE TABLE IF NOT EXISTS cipa_meeting_topics (
  id SERIAL PRIMARY KEY,
  meeting_id INTEGER REFERENCES cipa_meetings(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  status TEXT,
  deadline TEXT
);

CREATE TABLE IF NOT EXISTS occurrences (
  id SERIAL PRIMARY KEY,
  type TEXT,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  date TEXT,
  time TEXT,
  location TEXT,
  sector TEXT,
  description TEXT,
  injury TEXT,
  body_part TEXT,
  days_away INTEGER,
  status TEXT,
  cat_file_url TEXT,
  root_cause TEXT,
  corrective_action TEXT
);

CREATE TABLE IF NOT EXISTS exams (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  type TEXT,
  specific_exams TEXT,
  periodicity TEXT,
  exam_date TEXT,
  next_exam_date TEXT,
  status TEXT,
  file_url TEXT
);

CREATE TABLE IF NOT EXISTS standards (
  id SERIAL PRIMARY KEY,
  code TEXT,
  title TEXT,
  revision TEXT,
  date TEXT,
  description TEXT,
  file_url TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  expires_at BIGINT
);

INSERT INTO company_settings (id, company_name, company_address, company_phone, company_website, resp_name, resp_role, resp_email) 
VALUES (1, 'SST Gestão', 'Rua Exemplo, 123 - Centro', '(00) 0000-0000', 'www.sstgestao.com', 'Responsável SST', 'Engenheiro de Segurança', 'admin@sstgestao.com')
ON CONFLICT (id) DO NOTHING;
