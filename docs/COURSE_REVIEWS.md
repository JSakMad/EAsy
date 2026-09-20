# Course catalog and student reviews

The front-page course finder uses the bundled catalog in `config/course-catalog.json`. Repeated course codes are merged, field-of-study headings are retained as tags, special suffixes remain distinct, and alternative supplied titles remain searchable.

`config/course-catalog.json` is the portable catalog artifact. Searching works by case-insensitive code (with or without spaces), title, alternative title, and field-of-study keywords. The front page also searches professor names supplied by the API and progressively displays results. The supplied listing is not a current-semester schedule.

## Student flow

1. Search the front page by code, title, professor, or field; choose a course and follow its review link. Courses without reviews invite the first submission.
2. Sign in and complete the student profile if necessary.
3. Choose an existing professor using the name search, or enter the full name of a professor who is not listed.
4. Answer whether the student received an A or A−, choose difficulty from 1 to 5, select any actually observed profile-preference features, and optionally add up to 3,000 characters of comments.
5. Submit. PostgreSQL records the submission timestamp; the date is retained with the review. Client-supplied dates and author IDs are ignored.

Individual reviews and comments are not displayed. The review route contains only the submission form and confirmation. Comments feed the AI overview source; author names, emails, and user IDs are excluded. A student may submit one review per professor/course pairing and up to 10 per rolling 24 hours. Authentication, completed profiles, allowed tags, and school membership are checked server-side. Failed writes roll back.

## Scoring

Student reviews live in a separate `student_reviews` table rather than masquerading as imported records. New professors receive a `community:` source key and no external source URL. Reviews create a professor/course offering when needed. Courses with student reviews appear in the professor comparison search, including valid catalog codes outside the imported subject vocabulary.

For offerings with student reviews, the API recomputes the original score from both imported and first-party review inputs on read. Five total reviews are required. The existing import snapshots are preserved. A Yes answer contributes an A outcome and No contributes a non-A outcome. Difficulty is averaged across both sources. Class features with an exact, one-to-one existing tag mapping also contribute to the base class-structure component; broader categories are not expanded into unproven specific tags.

For personalization, all 12 selected feature types are counted directly from student submissions in `preferenceEvidence`. The scorer uses the strongest available direct preference count or related tag count, rather than double counting overlapping evidence. **Online classes now affects personal scores when explicitly reported by EAsy reviewers**; online quizzes never imply online classes. Imported comments alone still cannot establish delivery mode. Nonempty student comments join imported reviews in the AI overview source, with submission dates, grade answers, and difficulty. Source fingerprints invalidate outdated cached summaries.

## Database and deployment

Run these against the shared database used by both the API and the Next.js server:

```bash
npm run db:migrate
npm run catalog:import
```

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`.

Migration `010_catalog_student_reviews.sql` adds catalog metadata and the new review table. The import is transactional and repeatable, updating catalog titles and subject tags while preserving course IDs, existing offerings, and reviews. New review submissions can also create the selected catalog course if a catalog import has not yet run.

Deploy the API and website together after migrating; both now query the student-review table. The website needs private server-side access to schools, courses, professors, offerings, and student reviews, in addition to auth/profile data. The API needs SELECT access to student reviews. The current setup uses the private table-owner role; if using restricted roles, configure grants and RLS policies accordingly. No anonymous browser database access is introduced.

The bundled JSON makes the catalog available in every deployment. Database URLs must point to hosted PostgreSQL in production. A local catalog import does not update the hosted database.

Tests cover catalog completeness, deduplication, suffixes, search and pagination, validation, authentication, ownership, timestamps, duplicate and rate limits, transactional rollback, comment privacy, and combined professor scoring. PostgreSQL tests use only an isolated localhost database whose name ends in `_test`.
