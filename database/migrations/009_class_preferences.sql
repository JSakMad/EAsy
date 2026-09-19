-- NULL means the student has not reviewed the preference questions yet.
-- An empty array is an explicit choice to use no class preferences.
ALTER TABLE auth_student_profile ADD COLUMN class_preferences text[];
ALTER TABLE auth_student_profile ADD CONSTRAINT valid_class_preferences CHECK (
  class_preferences IS NULL OR (
    array_position(class_preferences, NULL) IS NULL AND
    cardinality(class_preferences) <= 12 AND
    class_preferences <@ ARRAY[
      'online_quizzes', 'online_classes', 'online_exams', 'open_book_exams',
      'optional_attendance', 'flexible_deadlines', 'group_projects', 'study_resources',
      'lighter_homework', 'quiz_retakes', 'extra_credit', 'no_cumulative_final'
    ]::text[]
  )
);
