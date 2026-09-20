# Subject validation and course normalization

The supported subject vocabulary lives in `packages/core/src/subjects.ts`. Dataset imports and offline correction tools use the same policy. The public catalog excludes unsupported subjects and unresolved records.

Subject validation is separate from catalog verification: a recognized subject does not prove that every possible number exists. Similar names and overlapping abbreviations are not merged without sufficient evidence.

## Matching rules

1. An exact review-ID override may specify a verified target course.
2. A bare course number resolves only when exactly one explicit course for the same professor shares that number.
3. Verified full-course aliases match known case and spacing variants.
4. Valid subject codes are retained, numbers are padded consistently, and Unicode spaces are normalized.
5. Explicit subject-typo repairs preserve the original course number.
6. Subject names, abbreviations, and close typos require exactly one same-professor, same-number match.
7. Anything else stays in private quarantine with its reason and candidate codes.

Only original labels containing valid subjects and explicit operator overrides supply corroborating evidence. Inferred mappings do not justify further guesses, and another professor's courses are never used as evidence.

## Review workflow

Preview normalization without changing course or review records:

```bash
npm run ingest:renormalize -- --dry-run
```

After reviewing the preview, back up the intended database and apply the changes:

```bash
npm run db:backup
npm run db:migrate
npm run ingest:renormalize
npm run ingest:status
```

For unresolved records, verify the course and add an exact source-review override to `config/review-course-overrides.json`. Verified full-course aliases belong in `config/course-aliases.json`. Never assign a course solely because it is a professor's most common class.

The `course_normalization_audit` table records the original label, previous and resulting course, matching method, policy version, and reason or candidates. It contains no review comments and is not public.
