CREATE TABLE offering_cloud_overviews (
  offering_id uuid PRIMARY KEY REFERENCES professor_course_offerings(id) ON DELETE CASCADE,
  summary jsonb,
  source_hash text,
  sample_metadata jsonb,
  model text,
  prompt_version text,
  generated_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error_code text
);
CREATE TABLE overview_api_budget (
  id integer PRIMARY KEY CHECK(id=1),
  request_day date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  attempts integer NOT NULL DEFAULT 0,
  next_request_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO overview_api_budget(id) VALUES(1);
ALTER TABLE offering_cloud_overviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE overview_api_budget ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON offering_cloud_overviews,overview_api_budget FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON offering_cloud_overviews,overview_api_budget FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON offering_cloud_overviews,overview_api_budget FROM authenticated; END IF;
END $$;
