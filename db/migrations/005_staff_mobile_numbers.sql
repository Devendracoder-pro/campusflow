ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_number text;
CREATE UNIQUE INDEX IF NOT EXISTS users_mobile_number_idx ON users (mobile_number) WHERE mobile_number IS NOT NULL;
