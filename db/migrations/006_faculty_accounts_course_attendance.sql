CREATE SEQUENCE IF NOT EXISTS faculty_code_seq START WITH 101;

ALTER TABLE faculty ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'faculty';
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS faculty_code text;

UPDATE faculty
SET faculty_code = 'CF-FAC-' || nextval('faculty_code_seq')::text
WHERE faculty_code IS NULL;

ALTER TABLE faculty ALTER COLUMN faculty_code SET NOT NULL;
ALTER TABLE faculty DROP CONSTRAINT IF EXISTS faculty_role_check;
ALTER TABLE faculty ADD CONSTRAINT faculty_role_check CHECK (role = 'faculty');
ALTER TABLE faculty DROP CONSTRAINT IF EXISTS faculty_created_by_fkey;
ALTER TABLE faculty ADD CONSTRAINT faculty_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS faculty_org_code_idx ON faculty (organization_id, faculty_code);

CREATE TABLE IF NOT EXISTS faculty_course_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  faculty_id uuid NOT NULL,
  course_id uuid NOT NULL,
  subject_name text NOT NULL CHECK (char_length(trim(subject_name)) BETWEEN 2 AND 160),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, faculty_id, course_id),
  FOREIGN KEY (organization_id, faculty_id) REFERENCES faculty(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, course_id) REFERENCES courses(organization_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS faculty_course_mappings_faculty_idx ON faculty_course_mappings (organization_id, faculty_id);
CREATE INDEX IF NOT EXISTS faculty_course_mappings_course_idx ON faculty_course_mappings (organization_id, course_id);

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS course_id uuid;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS faculty_id uuid;
UPDATE attendance a
SET course_id = s.course_id,
    faculty_id = c.faculty_id
FROM students s
LEFT JOIN courses c ON c.organization_id = s.organization_id AND c.id = s.course_id
WHERE a.organization_id = s.organization_id AND a.student_id = s.id AND a.course_id IS NULL;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_pkey;
ALTER TABLE attendance ADD CONSTRAINT attendance_pkey PRIMARY KEY (organization_id, student_id, course_id, attended_on);
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_course_fkey;
ALTER TABLE attendance ADD CONSTRAINT attendance_course_fkey FOREIGN KEY (organization_id, course_id) REFERENCES courses(organization_id, id) ON DELETE CASCADE;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_faculty_fkey;
ALTER TABLE attendance ADD CONSTRAINT attendance_faculty_fkey FOREIGN KEY (organization_id, faculty_id) REFERENCES faculty(organization_id, id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS attendance_faculty_course_idx ON attendance (organization_id, faculty_id, course_id, attended_on DESC);
