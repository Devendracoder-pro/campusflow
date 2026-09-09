ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_role_check;
ALTER TABLE memberships ADD CONSTRAINT memberships_role_check CHECK (role IN ('owner', 'principal', 'faculty', 'student', 'administrator', 'accountant', 'read_only'));
