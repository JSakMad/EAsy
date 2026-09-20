# Course catalog and student reviews

The `/catalog` page contains 6,114 unique course codes from the supplied `Courses 1.txt` and `Classes.txt` files. The files contained 6,251 course entries; 137 repeated codes were merged. All 190 section headings are retained as field-of-study tags. Special suffixes such as `NUR 1140IS` and `NUR 1140OS` remain distinct. `ECON 1910` has two supplied titles, both searchable; the first file's title is displayed.

`config/course-catalog.json` is the portable catalog artifact. Searching works by case-insensitive code (with or without spaces), title, alternative title, and field-of-study keywords. The field filter and 24-result pagination run on the server, so thousands of courses are not serialized into a client component. Field badges link back to filtered searches. The catalog is a supplied listing, not a statement that every course is available this semester.

## Student flow

1. Open **Course catalog**, search, and choose a course.
2. Sign in and complete the student profile if necessary.
3. Choose an existing professor using the name search, or enter the full name of a professor who is not listed.
4. Answer whether the student received an A or A−, choose difficulty from 1 to 5, select any actually observed profile-preference features, and optionally add up to 3,000 characters of comments.
5. Submit. PostgreSQL records the submission timestamp; the public review displays its date in UTC. Client-supplied dates and author IDs are ignored.

Reviews and comments are public on the course page, but account names, emails, and user IDs are not displayed. Comments are rendered as plain React text, never raw HTML. Imported review comments remain private and are not included in this page. A student may submit one review per professor/course pairing and up to 10 in a rolling 24 hours. Submission checks authentication, completed profiles, catalog membership, allowed tags, and professor ownership by school on the server. Duplicate and failed requests roll back all related writes.

## Scoring

Student reviews live in a separate `student_reviews` table rather than masquerading as imported records. New professors receive a `community:` source key and no RMP URL. Reviews create a professor/course offering when needed. Courses with student reviews appear in the existing professor comparison search, including valid catalog codes outside the imported subject vocabulary.

For offerings with student reviews, the API recomputes the original score from both imported and first-party review inputs on read. Five total reviews are required. The existing import snapshots are preserved. A Yes answer contributes an A outcome and No contributes a non-A outcome. Difficulty is averaged across both sources. Class features with an exact, one-to-one existing tag mapping also contribute to the base class-structure component; broader categories are not expanded into unproven specific tags.

For personalization, all 12 selected feature types are counted directly from student submissions in `preferenceEvidence`. The scorer uses the strongest available direct preference count or related tag count, rather than double counting overlapping evidence. **Online classes now affects personal scores when explicitly reported by EAsy reviewers**; online quizzes never imply online classes. Imported comments alone still cannot establish delivery mode. Student comments are not sent to the AI overview service.

## Database and deployment

Run these against the shared database used by both the API and the Next.js server:

```bash
npm run db:migrate
npm run catalog:import
```

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`.

Migration `010_catalog_student_reviews.sql` adds catalog metadata and the new review table. The import is transactional and repeatable, updating catalog titles and subject tags while preserving course IDs, existing offerings, and reviews. New review submissions can also create the selected catalog course if a catalog import has not yet run.

Deploy the API and website together after migrating; both now query the student-review table. The website needs private server-side access to schools, courses, professors, offerings, and student reviews, in addition to auth/profile data. The API needs SELECT access to student reviews. The current setup uses the private table-owner role; if using restricted roles, configure grants and RLS policies accordingly. No anonymous browser database access is introduced.

The bundled JSON makes the catalog available on Vercel without access to the original files in Downloads. Database URLs must point to hosted PostgreSQL in production. Local catalog import does not update the hosted database.

Tests cover catalog completeness, deduplication, suffixes, search and pagination, validation, authentication, ownership, timestamps, duplicate and rate limits, transactional rollback, comment privacy, and combined professor scoring. PostgreSQL tests use only an isolated localhost database whose name ends in `_test`.
