# Architecture

```text
Bundled catalog ───────────────┐
Pre-collected review dataset ──┼─> PostgreSQL <─> Express API on Render
Student reviews ───────────────┘                     │
                                                     │
Google OAuth ─> Better Auth ─> Next.js on Vercel <──┘
                                    │
                                    └─> Groq summaries and syllabus checks
```

## Applications

The Next.js application provides browsing, account management, review submission, personal preferences, and syllabus verification. Better Auth runs within the Next.js server and stores users, provider identities, sessions, and verification state in private PostgreSQL tables. The browser receives an HttpOnly session cookie on the web origin.

The Express API serves public course and offering data, calculates access-safe responses through positive field allowlists, and coordinates cached review summaries. Administrative routes require a server-side key.

The shared core package owns score calculation, tag metadata, the supported subject vocabulary, and course normalization so the API and frontend use consistent rules.

## Data model

Rankings operate at the professor-plus-course offering level. Grade-null reviews remain valid evidence but are excluded from the grade percentage denominator. Offerings with fewer than five reviews receive no score and display an insufficient-data state.

The database stores courses, professors, offerings, private review evidence, extracted tags, score snapshots, student reviews, profiles, preferences, auth records, summary caches, and syllabus-verification results. Raw comments and private evidence identifiers are never included in public API responses.

Course normalization applies verified aliases, validates subject codes, preserves original labels for auditability, and quarantines unresolved records. Tag extraction uses `config/tags.json`, including negation checks, and stores the matched signal with its confidence level.

## AI boundaries

Groq receives only the material required for the requested feature. Review overviews use a bounded sample of redacted comments. Syllabus checks use redacted extracted document text and the selected claims. Provider responses are schema-validated before storage or display, and secrets remain server-only.

See [AI overviews](AI_OVERVIEWS.md), [authentication](AUTHENTICATION.md), [course reviews](COURSE_REVIEWS.md), and [syllabus verification](SYLLABUS_VERIFICATION.md) for feature-specific details.
