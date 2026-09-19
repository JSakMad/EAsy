CREATE TABLE auth_student_profile (
  user_id text PRIMARY KEY REFERENCES auth_user(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  school_year text NOT NULL CHECK (school_year IN (
    'First year', 'Second year', 'Third year', 'Fourth year',
    'Fifth year or later', 'Graduate student', 'Other'
  )),
  major text NOT NULL CHECK (char_length(btrim(major)) BETWEEN 1 AND 120),
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON auth_student_profile FROM PUBLIC;
