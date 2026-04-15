INSERT INTO users (name, email, username, password_hash, role)
VALUES ('Administrador', 'admin@admin.com', 'admin', 'admin123', 'admin')
ON CONFLICT (username) DO NOTHING;
