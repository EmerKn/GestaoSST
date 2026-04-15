-- Ensure RLS is disabled for users table so login can work without an authenticated session
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Or if you prefer to keep RLS enabled, you need a policy that allows anonymous reads:
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow public read access to users" ON users FOR SELECT USING (true);
-- CREATE POLICY "Allow public update to users for password hashing" ON users FOR UPDATE USING (true);
