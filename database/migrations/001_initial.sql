CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rmp_school_id text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS professors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  department text NOT NULL,
  rmp_professor_id text NOT NULL UNIQUE,
  rmp_legacy_id integer,
  overall_quality numeric(3,2),
  overall_difficulty numeric(3,2),
  would_take_again_pct numeric(6,2)
);

CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  course_code text NOT NULL,
  course_title text,
  UNIQUE (school_id, course_code)
);

CREATE TABLE IF NOT EXISTS professor_course_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id uuid NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE (professor_id, course_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL REFERENCES professor_course_offerings(id) ON DELETE CASCADE,
  rmp_review_id text NOT NULL UNIQUE,
  date_posted timestamptz,
  grade_received text,
  difficulty_rating numeric(3,2) NOT NULL CHECK (difficulty_rating BETWEEN 1 AND 5),
  quality_rating numeric(3,2) CHECK (quality_rating BETWEEN 1 AND 5),
  attendance_mandatory boolean,
  raw_comment_text text NOT NULL,
  scraped_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  tag_type text NOT NULL CHECK (tag_type IN (
    'notecard_allowed', 'open_book_exam', 'online_exams', 'no_cumulative_final',
    'curve_applied', 'attendance_not_required', 'easy_a_explicit_mention', 'group_project_heavy'
  )),
  source text NOT NULL CHECK (source IN ('native_rmp', 'extracted_from_comment')),
  confidence numeric(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  UNIQUE (review_id, tag_type, source)
);

CREATE TABLE IF NOT EXISTS easy_a_score_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL REFERENCES professor_course_offerings(id) ON DELETE CASCADE,
  computed_at timestamptz NOT NULL DEFAULT now(),
  score numeric(6,3),
  grade_a_pct numeric(6,3),
  grade_response_count integer NOT NULL,
  avg_difficulty numeric(4,3),
  tag_bonus numeric(4,3) NOT NULL,
  review_count integer NOT NULL,
  grade_component numeric(6,3) NOT NULL,
  difficulty_component numeric(6,3) NOT NULL,
  tag_component numeric(6,3) NOT NULL
);

CREATE INDEX IF NOT EXISTS professors_school_department_idx ON professors(school_id, department);
CREATE INDEX IF NOT EXISTS reviews_offering_idx ON reviews(offering_id);
CREATE INDEX IF NOT EXISTS tags_review_type_idx ON tags(review_id, tag_type);
CREATE INDEX IF NOT EXISTS snapshots_offering_computed_idx ON easy_a_score_snapshots(offering_id, computed_at DESC);

INSERT INTO schools (name, rmp_school_id)
VALUES ('University of Pittsburgh', '1247')
ON CONFLICT (rmp_school_id) DO UPDATE SET name = EXCLUDED.name;
