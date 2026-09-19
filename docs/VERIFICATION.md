# Verification

## September 19, 2026 — Google OAuth accounts

- `npm run typecheck`: passed for all workspaces.
- `npm run build`: passed for core, Express API, and Next.js production output, including `/sign-in`, `/account`, and `/api/auth/[...all]`. No OAuth credentials were needed for the build.
- Final `npm test` with `AUTH_TEST_DATABASE_URL` pointing at an isolated localhost PostgreSQL 16 container: **455 passed, 29 skipped** (334 core, 64 API, 57 web). The 29 pre-existing API integration tests require their own opt-in and were not enabled. The web total includes 39 new auth tests, including two PostgreSQL integration tests.
- Auth tests cover missing/unsafe configuration, disabled sign-in, loading/error/retry states, server session enforcement, forged/expired cookies, invalid OAuth state, cross-origin sign-out rejection, session revocation, and preservation of auth redirect/cookie headers.
- PostgreSQL tests applied migration 007 in a temporary schema and compared it with Better Auth 1.7.5's schema requirements. An OAuth round trip with mocked Google network responses verified real state/PKCE handling, signed cookies, first-time account creation, repeat identity reuse, encrypted provider tokens, database rate-limit persistence, independent sessions, expiry, sign-out, and cascading identity deletion.
- The normal migration runner applied migrations 001–007 to the isolated test database. A second run completed without reapplying migrations.
- HTTP smoke checks against the production web build: `/sign-in` returned 200 with disabled sign-in when unconfigured; `/account` redirected to `/sign-in` (307); `/api/auth/get-session` returned 503 with `Cache-Control: no-store`; `/` remained publicly accessible (200).
- Verification used portable Node.js 22.23.2. Windows sandbox restrictions required test-worker permissions; the build required network access for the existing Google Fonts setup.

Limits: no live Google consent flow was performed because project OAuth credentials were not configured. Google responses in the integration test are synthetic; this does not verify Google client registration or production domain configuration. No production database, credentials, or deployment were changed. Complete the browser checks in [AUTHENTICATION.md](AUTHENTICATION.md) after configuring the OAuth client.

## September 14, 2026 — Historical ingestion verification

## Automated checks

- Core: 17 passing tests, including Unicode whitespace, omitted spaces, long subject names, leading zeroes, and ambiguous numeric course codes.
- API: 17 passing unit/route tests, including private-field exclusion and rate-limit/access-challenge handling.
- PostgreSQL integration: 7 passing tests against `easy_ingestion_test` using synthetic data only. These cover deduplication, original labels, quarantine corrections, moving reviews between courses, transaction rollback, shared locks/cooldowns, cached pagination, and database privilege denial.
- TypeScript checks and production builds: passed for core, API, and web.

## Bounded live check

- 10 total source requests, including the initial wildcard search which returned no results. The corrected school-only empty-text search reported 5,023 professors.
- Saved 40 professor directory entries; the full directory is not yet collected.
- Imported one professor, George Sparling. The first review run stopped at its request budget; the next resumed saved pages without refetching them.
- Stored 120 classified reviews across 24 normalized historical course codes, plus 8 private quarantined reviews needing course verification. This is not official catalog validation or current-semester coverage.
- No 429/access block was returned during this small check. That is not a guarantee for future runs.
- Four local public API endpoints checked; private comment, raw-label, staging-payload, and matched-text fields absent.
- Homepage and offering detail returned HTTP 200; the homepage rendered the real imported professor without a demo-data banner.

## Backup check

`npm run db:backup` created a private local custom-format PostgreSQL archive with checksum metadata and a verified archive index. A full restoration to the separate `easy_restore_test` database succeeded; restored counts matched 120 classified reviews and 8 quarantined reviews. The live database was not overwritten.

The scratch databases remain available for inspection. They are not used by the website. Backups, `.env`, raw data, scratch databases, and dependencies are intentionally excluded from the delivered source ZIP.

See [SCRAPER_SETUP.md](SCRAPER_SETUP.md) for commands and limitations.
