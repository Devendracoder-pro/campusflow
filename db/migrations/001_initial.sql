CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 160),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (char_length(email) <= 320),
  password_hash text NOT NULL,
  display_name text NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 2 AND 160),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memberships (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'administrator', 'faculty', 'accountant', 'read_only')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS faculty (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  department text NOT NULL,
  designation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email),
  UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  department text NOT NULL,
  credits integer NOT NULL CHECK (credits BETWEEN 1 AND 12),
  faculty_id uuid,
  fee numeric(12, 2) NOT NULL CHECK (fee >= 0),
  fee_cycle text NOT NULL DEFAULT 'Yearly' CHECK (fee_cycle IN ('Semester', 'Yearly')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, faculty_id) REFERENCES faculty(organization_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  roll text NOT NULL,
  email text NOT NULL,
  course_id uuid NOT NULL,
  year integer NOT NULL CHECK (year BETWEEN 1 AND 6),
  status text NOT NULL CHECK (status IN ('Active', 'Graduated', 'On leave')),
  joined date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, roll),
  UNIQUE (organization_id, email),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, course_id) REFERENCES courses(organization_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  paid_on date NOT NULL,
  method text NOT NULL CHECK (method IN ('Bank transfer', 'Cash', 'Card', 'UPI')),
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, idempotency_key),
  FOREIGN KEY (organization_id, student_id) REFERENCES students(organization_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS attendance (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attended_on date NOT NULL,
  status text NOT NULL CHECK (status IN ('Present', 'Absent', 'Late')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, student_id, attended_on),
  FOREIGN KEY (organization_id, student_id) REFERENCES students(organization_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memberships_user_idx ON memberships (user_id);
CREATE INDEX IF NOT EXISTS faculty_org_idx ON faculty (organization_id);
CREATE INDEX IF NOT EXISTS courses_org_idx ON courses (organization_id);
CREATE INDEX IF NOT EXISTS students_org_status_idx ON students (organization_id, status);
CREATE INDEX IF NOT EXISTS payments_org_date_idx ON payments (organization_id, paid_on DESC);
CREATE INDEX IF NOT EXISTS attendance_org_date_idx ON attendance (organization_id, attended_on DESC);
CREATE INDEX IF NOT EXISTS audit_logs_org_date_idx ON audit_logs (organization_id, created_at DESC);
