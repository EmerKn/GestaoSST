-- 0000_initial_schema.sql
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


-- 0001_work_permits.sql
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


-- 0002_inspection_terceiros.sql
CREATE TABLE IF NOT EXISTS inspection_terceiros (
  id SERIAL PRIMARY KEY,
  date TEXT,
  inspector TEXT,
  company_name TEXT,
  worker_name TEXT,
  worker_type TEXT,
  received_epi_instructions TEXT,
  received_training TEXT,
  participated_integration TEXT,
  has_necessary_epis TEXT,
  needs_work_permit TEXT,
  activity_description TEXT,
  accompanier_name TEXT,
  accompanier_role TEXT,
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


-- 0003_suppliers.sql
CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  contact_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS supplier_employees (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  employee_role TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);


-- 20260312_training_evaluations.sql
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


-- 20260312_update_suppliers.sql
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS cnpj TEXT;

ALTER TABLE supplier_employees 
ADD COLUMN IF NOT EXISTS cpf TEXT,
ADD COLUMN IF NOT EXISTS photo_url TEXT;


-- 20260312_update_suppliers_address.sql
-- Add new address fields to suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS address_number text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS zip_code text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS state text;


-- 20260312_update_trainings.sql
ALTER TABLE trainings 
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS enrolled INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS comments TEXT,
ADD COLUMN IF NOT EXISTS rating_content TEXT,
ADD COLUMN IF NOT EXISTS rating_visual TEXT,
ADD COLUMN IF NOT EXISTS rating_sound TEXT,
ADD COLUMN IF NOT EXISTS rating_instructor TEXT,
ADD COLUMN IF NOT EXISTS rating_understanding TEXT;


-- 20260313_training_evaluations_update.sql
ALTER TABLE training_evaluations ADD COLUMN IF NOT EXISTS rating_sound_images INTEGER DEFAULT 5;
ALTER TABLE training_evaluations ADD COLUMN IF NOT EXISTS rating_materials INTEGER DEFAULT 5;


-- 20260313_training_participants.sql
ALTER TABLE trainings ADD COLUMN IF NOT EXISTS participants TEXT[] DEFAULT '{}';


-- 20260316_pcmso_exams.sql
CREATE TABLE IF NOT EXISTS pcmso_exams (
  id SERIAL PRIMARY KEY,
  exam_name TEXT NOT NULL,
  function_name TEXT NOT NULL,
  sector TEXT NOT NULL,
  periodicity TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 20260316_pgr_reports.sql
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


-- 20260316_ppe_updates.sql
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


-- 20260317_cipa_meetings_jsonb.sql
ALTER TABLE cipa_meetings ADD COLUMN IF NOT EXISTS participants JSONB;
ALTER TABLE cipa_meetings ADD COLUMN IF NOT EXISTS topics JSONB;


-- 20260317_insert_test_fispq.sql
INSERT INTO produtos_quimicos (
  trade_name,
  product_name,
  chemical_composition,
  required_ppe,
  pictograms,
  fispq_url,
  sectors,
  roles
) VALUES (
  '407',
  'Adesivo de contato',
  'Adesivo de contato à base de borrachas e resinas sintéticas, aditivos e solventes orgânicos. Ingredientes: Segredo industrial 1 (20-40%), Tolueno (5-20%), Acetona (5-20%).',
  'Óculos de proteção, sapatos fechados, vestimenta de proteção adequada, creme de proteção para as mãos, luvas de proteção adequadas, máscara de proteção com filtro contra vapores e névoas.',
  ARRAY['Inflamável', 'Irritante', 'Perigo à saúde'],
  NULL,
  ARRAY['Produção', 'Manutenção'],
  ARRAY['Operador', 'Mecânico']
);


-- 20260317_produtos_quimicos.sql
CREATE TABLE IF NOT EXISTS produtos_quimicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_name text NOT NULL,
  product_name text,
  chemical_composition text,
  required_ppe text,
  pictograms text[],
  fispq_url text,
  sectors text[],
  roles text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE produtos_quimicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read produtos_quimicos"
  ON produtos_quimicos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert produtos_quimicos"
  ON produtos_quimicos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update produtos_quimicos"
  ON produtos_quimicos FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to delete produtos_quimicos"
  ON produtos_quimicos FOR DELETE
  TO authenticated
  USING (true);


-- 20260318_agenda_events.sql
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


-- 20260318_fix_login.sql
-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL
);

-- Disable Row Level Security to allow login checks
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Insert the default admin user
INSERT INTO users (name, email, username, password_hash, role)
VALUES ('Administrador', 'admin@admin.com', 'admin', 'admin123', 'admin')
ON CONFLICT (username) DO UPDATE SET password_hash = 'admin123';


-- 20260318_fix_rls.sql
-- Ensure RLS is disabled for users table so login can work without an authenticated session
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Or if you prefer to keep RLS enabled, you need a policy that allows anonymous reads:
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow public read access to users" ON users FOR SELECT USING (true);
-- CREATE POLICY "Allow public update to users for password hashing" ON users FOR UPDATE USING (true);


-- 20260318_google_auth.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  type TEXT DEFAULT 'info',
  action_url TEXT
);


-- 20260318_hydrant_tests.sql
-- Migration to create hydrant_tests table

CREATE TABLE IF NOT EXISTS hydrant_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id),
    test_date DATE NOT NULL,
    hydrant_name TEXT NOT NULL,
    location TEXT NOT NULL,
    participants TEXT[] NOT NULL DEFAULT '{}',
    photo_url TEXT,
    check_hydrant BOOLEAN DEFAULT false,
    check_hoses BOOLEAN DEFAULT false,
    check_storz_key BOOLEAN DEFAULT false,
    observations TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE hydrant_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read hydrant_tests" ON hydrant_tests 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert hydrant_tests" ON hydrant_tests 
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update hydrant_tests" ON hydrant_tests 
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete hydrant_tests" ON hydrant_tests 
    FOR DELETE TO authenticated USING (true);


-- 20260318_initial_user.sql
INSERT INTO users (name, email, username, password_hash, role)
VALUES ('Administrador', 'admin@admin.com', 'admin', 'admin123', 'admin')
ON CONFLICT (username) DO NOTHING;


-- 20260319_laudos.sql
CREATE TABLE IF NOT EXISTS laudos (
  id SERIAL PRIMARY KEY,
  year INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  actions_by_sector_function JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 20260319_ppes_additional_fields.sql
ALTER TABLE ppes ADD COLUMN IF NOT EXISTS commercial_name TEXT;
ALTER TABLE ppes ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE ppes ADD COLUMN IF NOT EXISTS complementary_data TEXT;


-- 20260326_evacuation_drills.sql
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


-- 20260406_brigade_training_schedules.sql
CREATE TABLE IF NOT EXISTS brigade_training_schedules (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  observations TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- 20260406_drill_organograms.sql
CREATE TABLE IF NOT EXISTS drill_organograms (
  id SERIAL PRIMARY KEY,
  drill_id INTEGER REFERENCES evacuation_drills(id) ON DELETE CASCADE,
  roles JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


