# Personal professor scores

Signed-in students select the class features they prefer during account setup. Their personal score replaces the displayed EAsy score on course comparison cards and professor detail pages, and is the default comparison sort. Anonymous visitors and demo examples continue to use the original score. Difficulty and review-count sorting remain available.

Students can edit or clear their selections under **My account → Edit profile**. No selection means the original calculation is used. Existing students are asked to review these questions once. Name, major, and schooling year are not used to infer preferences or change scores.

## Calculation v1

The original score is the starting point: reported grades (50%), lower difficulty (35%), and class-structure signals (15%). The personal score adds a bounded preference boost:

```text
support for each selected preference = min(1, distinct review mentions / 3)
coverage = sum(support) / number of selected preferences
personal score = original score + (100 - original score) × 0.30 × coverage
```

For a preference represented by several related tags, use the highest individual tag count rather than summing potentially overlapping reviews. The API counts distinct reviews per tag so multiple extraction sources do not count twice. A single mention receives one-third weight; three or more mentions reach full weight. These weights are an initial product choice, not a calibrated probability or a prediction of the student's grade.

For example, an original score of 60 becomes 64 with one supporting online-quiz review, or 72 with three, if online quizzes are the student's only supported preference. Selecting no preferences or finding no matching evidence leaves the original score unchanged. Missing reports mean unknown, not that a feature is absent. An offering with fewer than five reviews, or no original score, remains unscored.

Preference matching adds no raw review text to the public API. It exposes only per-tag review counts. Personalized scores are calculated from the signed-in student's server-loaded preferences and the same public offering data; they are not written into shared score snapshots or public caches.

## Available preferences

Online quizzes, online exams, open-book exams, optional attendance, flexible deadlines, group projects, provided study materials, less homework, quiz retakes, extra credit, and no cumulative final map to existing historical review tags.

**Online classes** now affects scores when explicitly reported in an EAsy student review. Imported online quizzes or optional attendance are never treated as evidence that the class itself is online. Direct student feature reports are supplied as `preferenceEvidence`; the scorer uses the maximum direct count or related-tag count to avoid double counting. See [course reviews](COURSE_REVIEWS.md).

These are historical reports for a professor/course pairing, not verified current section policies. Each personalized card lists supported preferences, and the detail page shows supporting mention counts and unreported preferences.

## Setup and migration

Run `npm run db:migrate` (or `npm.cmd run db:migrate` in Windows PowerShell). Migration `009_class_preferences.sql` adds a constrained `text[]` column to `auth_student_profile`. `NULL` means the student has not reviewed the questions; `[]` is an explicit no-preference choice. The migration preserves accounts, existing profile details, and all course records. The existing web role's permissions on the profile table cover the new column.

Deploy the API and web workspaces together: scoring requires the public `tagEvidence` field. Responses without that field receive no preference boost.

Implementation: `packages/core/src/personal-score.ts`, `apps/web/lib/profile-fields.ts`, and `apps/api/src/repository.ts`. Regression tests cover ranking changes, numeric PostgreSQL values, limited evidence, unknown delivery mode, overlapping tags, persistence, validation, and anonymous behavior.
