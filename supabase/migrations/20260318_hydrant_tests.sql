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
