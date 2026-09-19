ALTER TABLE reviews ADD COLUMN IF NOT EXISTS normalization_method text;
ALTER TABLE ingestion_quarantine ADD COLUMN IF NOT EXISTS candidates jsonb NOT NULL DEFAULT '[]';
ALTER TABLE ingestion_quarantine ADD COLUMN IF NOT EXISTS normalization_version text;

CREATE TABLE IF NOT EXISTS course_normalization_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id uuid NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
  review_source_id text NOT NULL,
  raw_course text NOT NULL,
  from_course_code text,
  to_course_code text,
  method text NOT NULL,
  reason text NOT NULL,
  candidates jsonb NOT NULL DEFAULT '[]',
  policy_version text NOT NULL,
  normalized_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS course_normalization_audit_source_idx ON course_normalization_audit(review_source_id,normalized_at DESC);
ALTER TABLE course_normalization_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE course_normalization_audit FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON TABLE course_normalization_audit FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON TABLE course_normalization_audit FROM authenticated; END IF;
END $$;
