CREATE TABLE IF NOT EXISTS offering_ai_overviews (
  offering_id uuid PRIMARY KEY REFERENCES professor_course_offerings(id) ON DELETE CASCADE,
  source_hash text NOT NULL,
  prompt_version text NOT NULL,
  model text NOT NULL,
  summary jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE offering_ai_overviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE offering_ai_overviews FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON TABLE offering_ai_overviews FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON TABLE offering_ai_overviews FROM authenticated; END IF;
END $$;
