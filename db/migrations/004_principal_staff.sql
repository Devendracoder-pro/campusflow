ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id text;
UPDATE users SET employee_id = 'CF-' || upper(substr(replace(id::text, '-', ''), 1, 8)) WHERE employee_id IS NULL;
ALTER TABLE users ALTER COLUMN employee_id SET DEFAULT ('CF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)));
ALTER TABLE users ALTER COLUMN employee_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_employee_id_idx ON users (employee_id);

ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_role_check;
ALTER TABLE memberships ADD CONSTRAINT memberships_role_check CHECK (role IN ('owner', 'principal', 'administrator', 'faculty', 'accountant', 'read_only'));
