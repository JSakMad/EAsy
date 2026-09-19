ALTER TABLE reviews ADD COLUMN IF NOT EXISTS raw_course text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS normalization_version text;
ALTER TABLE professors ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
UPDATE professors SET is_demo=true WHERE rmp_professor_id LIKE 'demo-%';

CREATE TABLE IF NOT EXISTS ingestion_control (
  source text PRIMARY KEY,
  next_request_at timestamptz NOT NULL DEFAULT now(),
  request_day date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  requests_today integer NOT NULL DEFAULT 0,
  blocked_reason text,
  discovery_cursor text,
  discovery_complete boolean NOT NULL DEFAULT false,
  discovery_completed_at timestamptz,
  reported_professor_count integer
);
INSERT INTO ingestion_control(source) VALUES ('rmp') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS ingestion_queue (
  source_id text PRIMARY KEY,
  legacy_id integer NOT NULL,
  name text NOT NULL,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  last_completed_at timestamptz,
  last_error text
);

-- Private staging for interrupted imports: only complete professor imports are published.
CREATE TABLE IF NOT EXISTS ingestion_page_cache (
  professor_id text NOT NULL,
  cursor text NOT NULL DEFAULT '',
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (professor_id, cursor)
);

CREATE TABLE IF NOT EXISTS ingestion_quarantine (
  review_id text PRIMARY KEY,
  professor_id uuid NOT NULL REFERENCES professors(id),
  raw_course text NOT NULL,
  reason text NOT NULL,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  requests integer NOT NULL DEFAULT 0,
  professors_completed integer NOT NULL DEFAULT 0,
  message text
);

-- Deny public PostgreSQL and Supabase browser roles direct table access.
-- The API and jobs use a private server-side connection, never an anon key.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['schools','professors','courses','professor_course_offerings',
    'reviews','tags','easy_a_score_snapshots','ingestion_control','ingestion_queue',
    'ingestion_page_cache','ingestion_quarantine','ingestion_runs'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', t);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM anon', t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated', t);
    END IF;
  END LOOP;
END $$;
