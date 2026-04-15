-- Insert mock data for initial setup

INSERT INTO company_settings (id, company_name, company_address, company_phone, company_website, resp_name, resp_role, resp_email) 
VALUES (1, 'SST Gestão', 'Rua Exemplo, 123 - Centro', '(00) 0000-0000', 'www.sstgestao.com', 'Responsável SST', 'Engenheiro de Segurança', 'admin@sstgestao.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (name, email, username, password_hash, role) 
VALUES 
('Administrador', 'admin@sstgestao.com', 'admin', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'master'),
('Desenvolvedor', 'dev@sstgestao.com', 'dev', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'master')
ON CONFLICT (username) DO NOTHING;

INSERT INTO employees (name, cpf, role, sector, shift, photo_url, admission_date, gender) VALUES 
('João da Silva', '111.222.333-44', 'Operador de Máquinas', 'Produção', 'Manhã', 'https://picsum.photos/seed/joao/200/200', '2023-01-15', 'Masculino'),
('Maria Souza', '555.666.777-88', 'Técnica de Segurança', 'SESMT', 'Manhã', 'https://picsum.photos/seed/maria/200/200', '2022-05-10', 'Feminino'),
('Carlos Pereira', '999.888.777-66', 'Eletricista', 'Manutenção', 'Tarde', 'https://picsum.photos/seed/carlos/200/200', '2021-11-20', 'Masculino');

INSERT INTO ppes (name, ca, price, photo_url, stock) VALUES 
('Capacete de Segurança', '12345', 25.50, 'https://picsum.photos/seed/capacete/200/200', 50),
('Luva de Raspa', '54321', 12.00, 'https://picsum.photos/seed/luva/200/200', 100),
('Protetor Auricular', '98765', 5.00, 'https://picsum.photos/seed/protetor/200/200', 200);

INSERT INTO fire_equipment (type, location, next_inspection, hydrostatic_test, status) VALUES 
('Extintor PQS 4kg', 'Setor de Produção - Pilastra 2', '2026-12-01', '2028-12-01', 'Regular'),
('Hidrante', 'Corredor Principal', '2026-06-15', '2027-06-15', 'Regular');

INSERT INTO brigade_members (employee_id, brigade_role) VALUES 
(1, 'Combate a Incêndio'),
(3, 'Primeiros Socorros');

INSERT INTO occurrences (type, employee_id, date, time, location, sector, description, injury, body_part, days_away, status) VALUES 
('Acidente', 1, '2024-01-10', '14:30', 'Máquina 01', 'Produção', 'Corte no dedo', 'Corte', 'Dedo da mão', 2, 'Concluído');

INSERT INTO exams (employee_id, type, specific_exams, periodicity, exam_date, next_exam_date, status) VALUES 
(1, 'Periódico', 'Clínico, Audiometria', '12 meses', '2024-02-01', '2025-02-01', 'Realizado');
