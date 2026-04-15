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
