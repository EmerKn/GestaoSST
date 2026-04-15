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
