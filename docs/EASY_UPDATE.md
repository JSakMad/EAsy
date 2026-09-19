# EAsy course-first update — September 15, 2026

## Student workflow

1. Search for a course such as `CS1530`, `CS 1530`, or `NROSCI0080`; optionally filter by subject.
2. Select the course to compare only professors with imported reviews for that exact course. Professor department does not constrain this comparison.
3. Highest EAsy score appears first by default. Alternative sorts show lowest difficulty or most reviews. Unscored professors remain visible below scored results in the default sort.
4. Filter using grouped student-reported tags, then open the score breakdown. The detail page links back to the same course comparison.

Courses without imported reviews are not invented. These are historical professor/course pairings, not verified current-semester sections. Small sample sizes and inferred tags remain limitations.

## Branding and motion

The visible wordmark, page metadata, homepage copy, and favicon now use EAsy. The opening has staggered text, a gold underline reveal, a soft glow, and an arriving score card. Motion runs once rather than looping; system reduced-motion preferences disable animation and animated scrolling. No additional animation dependency was added. The old share-preview image is no longer referenced by metadata.

## Expanded tags

The 23 new tags bring the total to 31; `easy_a_explicit_mention` already existed and is not duplicated. Categories are Exam format, Study resources, Grading policy, Workload, and Explicit signals. Every supplied trigger phrase has a regression test. Rules also handle common phrasing variants and ordinary negation; extraction remains heuristic, not a verified statement of course policy.

Online quizzes no longer imply online exams. Existing `curve_applied` remains distinct from `generous_curve`. A review may match multiple tags, but each tag is stored only once per review/source.

The score formula remains 50% grade outcomes, 35% inverted difficulty, and a capped 15% tag component. The five-review scoring minimum is unchanged. Additional tags can change an offering's score within that existing cap. The new GPA-booster tag has no special extra weight. Some descriptive tags (such as few assignments or group projects) are preferences, not universally easier policies; the inherited scoring formula still counts distinct tags equally.

## Update and reprocess locally

The current local database has already been backed up, migrated, and retagged. For another installation or future rule updates:

```bash
docker compose up -d postgres
npm run db:backup
npm run db:migrate
npm run ingest:retag
npm run dev
```

`ingest:retag` takes the same database lock as scraping, processes each professor transactionally, replaces extracted tags, and records updated score snapshots. It never calls RMP or edits raw reviews, course assignments, review dates, quarantined reviews, or import checkpoints. Previously completed professors need not be re-scraped. Quarantined reviews receive tags when their course is resolved through the existing workflow. Do not seed or recreate the live database for this update.

The pre-change backup is `data/backups/easy-2026-09-15T17-36-01-995Z.dump`. It contains private data; keep it unshared. A restored copy in `easy_rebrand_backup_test` was used to confirm identical checksums for reviews, courses, and quarantine after retagging. This scratch database is not used by the website.

## API additions

- `GET /schools/1247/courses`: public course code/title, professor count, review count. No private review fields.
- `GET /courses/CS1530/offerings`: canonicalizes subject/number, lists matching professors across departments, and sorts by score then sample size. Supports AND-style `?tags=online_quizzes,extra_credit_offered` filters. Bare course numbers return 400.

Existing department and detail endpoints remain available. No raw-review endpoint was added.

## Verification

Unit/API tests, isolated PostgreSQL integration tests, typechecking, and production builds were run. Live HTTP checks confirmed the course catalog, equivalent spaced/unspaced queries, a two-professor comparison for MATH 0200, the EAsy homepage, and private-field exclusion. Browser automation was unavailable in this session, so the animations and responsive layout have not been visually verified.
