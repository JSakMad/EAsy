# Architecture

## Account system (2026-09-19)

The Next.js Node.js server also hosts Better Auth at `/api/auth/*` and connects directly to PostgreSQL for the private `auth_*` tables. Google OAuth creates a durable user/provider identity and a database session; the browser receives an HttpOnly cookie on the web origin. `/account` validates the session on the server. The header uses the same-origin session API for navigation state. Express course endpoints remain public and administrator routes retain their existing authorization.

Migration 007 adds users, accounts, sessions, verification state, and shared rate limiting. Web deployments now need server-only database and OAuth environment settings. See [AUTHENTICATION.md](AUTHENTICATION.md) for setup, security boundaries, and verification, and [CHANGELOG.md](CHANGELOG.md) for dated changes.

```text
GitHub Actions (weekly) ──> IngestionSource ──> PostgreSQL
                                │                    │
                                └─ normalize/tags    ├─ historical snapshots
                                                     │
Next.js on Vercel <──────── Express API on Render <─┘
```

Ranking happens at professor-plus-course offering level. The scheduled job stores snapshots, so page requests only read indexed, precomputed values. Grade-null reviews remain valid reviews but are excluded from the grade percentage denominator. Offerings with fewer than five total reviews receive a `null` score and appear as “insufficient data.”

Tag extraction uses the dictionary in `config/tags.json`, runs negation checks, and stores confidence plus source. Course normalization rejects bare numbers, checks subject-bearing aliases, then applies a subject/number regex with Unicode whitespace handling. Unresolved reviews stay in private quarantine and are excluded from rankings; verified per-review overrides can resolve them offline.

The database stores a shared import lock, request counters/cooldowns, directory cursor, professor queue, and private partial-page cache. Complete professor saves, tags, scores, and checkpoints commit together. Public responses use positive field allowlists. See [SCRAPER_SETUP.md](SCRAPER_SETUP.md) for operational details and the distinction between historical review coverage and current course availability.
