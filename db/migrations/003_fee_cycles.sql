ALTER TABLE courses ADD COLUMN IF NOT EXISTS fee_cycle text NOT NULL DEFAULT 'Yearly';
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_fee_cycle_check;
ALTER TABLE courses ADD CONSTRAINT courses_fee_cycle_check CHECK (fee_cycle IN ('Semester', 'Yearly'));
