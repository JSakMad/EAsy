CREATE TABLE syllabus_verifications (
  review_id uuid PRIMARY KEY REFERENCES student_reviews(id) ON DELETE CASCADE,
  document_hash text NOT NULL CHECK (document_hash ~ '^[a-f0-9]{64}$'),
  preferences text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  checked_at timestamptz NOT NULL DEFAULT now(),
  checker_version integer NOT NULL DEFAULT 1
);
CREATE TABLE syllabus_upload_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX syllabus_upload_attempts_user_date ON syllabus_upload_attempts(user_id, attempted_at DESC);
ALTER TABLE syllabus_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabus_upload_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON syllabus_verifications, syllabus_upload_attempts FROM PUBLIC;
