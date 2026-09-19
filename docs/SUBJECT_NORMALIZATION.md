# Subject validation and course cleanup — September 16, 2026

## What changed

The 216 subject codes and names supplied by the project owner are now the supported subject vocabulary in `packages/core/src/subjects.ts`. New imports and offline cleanup use the same policy. The public course catalog excludes unsupported subjects and empty historical offerings.

The policy distinguishes subject validation from course-catalog verification: a supported subject does not prove that every number exists. The supplied list contains subjects with overlapping names, so valid codes such as `MRKT` and `BUSMKT`, or `BIOL` and `BIOSC`, are never merged merely because their names are similar. No semester availability is inferred.

## Matching rules, in order

1. An exact review-ID override may specify a target with a supported subject.
2. A bare three/four-digit number is resolved only if exactly one already explicit course for the **same professor** has that number. Two-digit labels and ambiguous numbers remain unresolved. Global numeric aliases are ignored.
3. Verified full-course aliases match case/spacing variants, including `CALC1` and `CALC 1`.
4. Valid subject codes are retained; numbers are padded to four digits, and Unicode spaces are normalized.
5. Explicit subject-typo repairs preserve the number: `BUSMT`, `BSMKT`, `BUMKT`, and `BUSMK` become `BUSMKT`; `NEUROSCI` becomes `NROSCI`.
6. Full subject names, abbreviations, and one-edit subject typos require exactly one same-professor, same-number match. For example, `MARKETING1040` or `MKTG1040` may resolve to `BUSMKT 1040` when that professor has explicitly labeled reviews for that course and not for `MRKT 1040`.
7. Anything else stays in private quarantine, with a reason and candidate codes. Candidates are suggestions, not proof that a course exists.

Only original labels containing valid subjects, plus explicit operator overrides, supply corroborating evidence. Inferred mappings do not justify other guesses, and another professor's courses are never used as evidence. The classification therefore does not depend on processing order.

`CALC12`, `CALCULUS123`, `NEURO1`, and course names without sufficient identifying information are not turned into invented course numbers. `MUS0311` can merge into a corroborated `MUSIC 0311`, whereas `MUS112` remains unresolved without corroboration or an explicit verified override.

The calculus sequence aliases use `MATH 0220`, `MATH 0230`, and `MATH 0240` for Calculus I, II, and III, consistent with [Pitt's Mathematics course descriptions](https://www.mathematics.pitt.edu/core-and-honors-courses). Review specific aliases if historical/campus-specific titles require a different course. Existing non-calculus full-course aliases were retained.

## Applied results

- Real source records examined: 610 (classified reviews plus quarantine, excluding demo fixtures).
- Reviews moved between course options: 108.
- Previously quarantined reviews recovered: 7.
- Previously classified reviews moved to quarantine: 10.
- Searchable course options: 55 → 35.
- Final real classified reviews: 573; quarantined: 37.

Examples include 65 reviews consolidated into `BUSMKT 1040`, 23 into `MUSIC 0311`, and 8 into `NROSCI 0080`. Math aliases and uniquely corroborated numbers were also corrected. Scores and tags were recalculated transactionally with each professor's update.

No RMP scraping was performed for this cleanup. Import progress and limits are not reset. Existing classified reviews retain their scrape timestamps when reclassified offline. The original `raw_course` is retained, not overwritten with the corrected label.

## Safety and audit

The pre-change backup is `data/backups/easy-2026-09-16T13-38-29-355Z.dump`. It was restored successfully into the separate `easy_subject_backup_test` database. Do not share this archive: it contains private reviews.

Before/after checksums match across all 641 retained source records (including 31 demo reviews), covering source IDs, original course labels, comment text, posted dates, grades, difficulty, quality, and attendance. Corrections did not delete source data. Moving a review into quarantine removes its classified database row and derived tags from rankings, but keeps the source data in private quarantine; moving it back regenerates tags. Internal row IDs may change when a quarantined review is restored, but its unique source review ID is preserved.

`course_normalization_audit` records the source review ID, original label, old/new course, matching method, policy version, and reason/candidates. It is private, has row-level security enabled, and contains no review comments. Empty legacy course/offering rows and historical score snapshots are retained privately for traceability, not shown as searchable classes. A repeat preview after cleanup reported zero further moves.

## Commands

Preview future corrections without modifying course/review records:

```bash
npm run ingest:renormalize -- --dry-run
```

After reviewing the preview, back up and apply:

```bash
npm run db:backup
npm run db:migrate
npm run ingest:renormalize
npm run ingest:status
```

Your local migration and cleanup have already been applied. Existing scraper commands are unchanged; future imports automatically use the policy.

For unresolved reviews, inspect `npm run ingest:status`, verify the course, and add the exact source review ID to `config/review-course-overrides.json`. Full-course aliases belong in `config/course-aliases.json`. Subject spellings and contextual abbreviations are in `packages/core/src/subjects.ts`. After a rule edit, preview first, then apply. Never assign a course solely because it is a professor's most common class.

Legacy records missing their original course label are skipped by offline cleanup rather than having a fabricated original label written. None were skipped in this database.
