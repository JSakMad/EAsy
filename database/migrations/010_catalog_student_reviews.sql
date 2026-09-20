ALTER TABLE courses ADD COLUMN is_catalog boolean NOT NULL DEFAULT false;
ALTER TABLE courses ADD COLUMN fields_of_study text[] NOT NULL DEFAULT '{}';

CREATE TABLE student_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  offering_id uuid NOT NULL REFERENCES professor_course_offerings(id) ON DELETE CASCADE,
  received_a boolean NOT NULL,
  difficulty smallint NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  tags text[] NOT NULL DEFAULT '{}',
  comments text NOT NULL DEFAULT '' CHECK (char_length(comments) <= 3000),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, offering_id),
  CHECK (cardinality(tags) <= 12 AND array_position(tags, NULL) IS NULL AND tags <@ ARRAY[
    'online_quizzes','online_classes','online_exams','open_book_exams','optional_attendance',
    'flexible_deadlines','group_projects','study_resources','lighter_homework','quiz_retakes',
    'extra_credit','no_cumulative_final'
  ]::text[])
);
CREATE INDEX student_reviews_offering_date_idx ON student_reviews(offering_id, submitted_at DESC, id);
CREATE INDEX student_reviews_user_date_idx ON student_reviews(user_id, submitted_at DESC);
ALTER TABLE student_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON student_reviews FROM PUBLIC;
