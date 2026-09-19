# EAsy: local setup and private Pitt imports

Updated September 16: subject validation now uses the supplied 216-code list. See [SUBJECT_NORMALIZATION.md](SUBJECT_NORMALIZATION.md) for the current matching policy and `npm run ingest:renormalize -- --dry-run`. Bare numbers may now resolve only with a unique, explicitly labeled course for the same professor; otherwise they remain quarantined.

Agreed scope: all historical Pitt courses represented in RMP reviews, not semester-specific course availability. Semester scheduling is deferred. The importer is configured for a school-wide traversal; only the bounded verification batch has been run so far.

## Start on your Mac

Open Docker Desktop and wait for its engine to be ready. In VS Code's terminal:

```bash
cd "/Users/joshua/Library/CloudStorage/OneDrive-Personal/Projects/EAsy"
docker version
docker compose version
docker compose up -d postgres
npm install
npm run db:migrate
npm run dev
```

Leave `npm run dev` running. Open http://localhost:3000; API health is http://localhost:4000/health. Docker runs PostgreSQL; Node runs the web/API on your Mac. This is not an all-services-in-Docker setup.

Your existing `.env` has been configured; do not replace it with `.env.example`. On a fresh installation only, copy the example and set `apps/web/.env.local` to `NEXT_PUBLIC_API_URL=http://localhost:4000`.

Troubleshooting:

- `docker: command not found`: open Docker Desktop, enable its CLI tools installation, then open a new terminal. Use `docker compose`, not the older `docker-compose` command.
- `Cannot connect to the Docker daemon`: start Docker Desktop and wait for the engine.
- Port 5432 already allocated: inspect `docker ps` and `lsof -nP -iTCP:5432 -sTCP:LISTEN`; don't delete unrelated databases or volumes.
- Database connection refused: run `docker compose ps` and `docker compose logs --tail 50 postgres`.
- Run `docker compose stop` to stop PostgreSQL without removing saved data. Never use `docker compose down -v` unless you intentionally want to delete this project's database volume.

## Current request controls

The local `.env` contains:

```dotenv
RMP_INGESTION_ENABLED=true
RMP_TERMS_REVIEWED=true
RMP_REQUEST_DELAY_MS=5000
RMP_MAX_REQUESTS_PER_RUN=50
RMP_MAX_REQUESTS_PER_DAY=200
RMP_MAX_PROFESSORS_PER_RUN=5
```

These are workload caps, not promises of a safe or allowed request rate. New installations default to disabled. Setting the flags records your decision; it is not permission from RMP. Review text staying private does not remove ownership or terms issues: [RMP Terms of Use](https://www.ratemyprofessors.com/terms-of-use).

Only one job may run against the shared database at a time. Requests are sequential and at least five seconds apart with these settings. The database persists the daily request count, next allowed request, directory cursor, completed professors, and partial review pages. Restarting a process does not reset them. Failed attempts count toward the cap.

- HTTP 429 stops the run immediately; the pause is at least 24 hours or a longer `Retry-After` value.
- HTTP 401/403, redirects, or a non-JSON challenge block further imports pending source-access review. Do not clear a block just to retry.
- Other HTTP/network/GraphQL errors stop the run with an hour-long cooldown.
- Source validation failures stop without publishing partial professor scores. Diagnose before repeating a failed run.
- No automatic retries, proxy rotation, CAPTCHA bypass, browser impersonation, or contact-email transmission are implemented.

All jobs must use the same database. Running separate databases from the same connection/IP defeats shared accounting. `requests_today` is for the displayed UTC `request_day`; it resets on the next request after that day ends.

## Start small and resume

Use a second terminal in EAsy:

```bash
npm run ingest:status
npm run ingest -- --limit 1 --max-requests 5
npm run ingest:status
```

This discovers one page of Pitt's professor directory and attempts one complete professor import. Professors with many reviews need multiple runs. `budget_reached` is normal: saved pages are reused, and no partial professor results are published. Re-run the same command later to progress; it does not duplicate reviews.

For a specific professor, use the numeric ID at the end of their RMP profile URL:

```bash
npm run ingest -- --professor 148318 --max-requests 10
```

The example above was used for the live resumability check; don't repeatedly refresh completed professors without a reason. Explicit IDs skip the seven-day freshness check but still obey all request controls.

## Work through the Pitt directory

```bash
npm run ingest -- --limit 5 --max-requests 50
npm run ingest:status
```

Run bounded batches and inspect status between runs. Do not use a tight shell loop. Stop when paused or blocked; let daily caps and cooldowns expire. Normal batches prioritize never-imported professors, then professors last completed more than seven days ago.

The September 14, 2026 live directory check reported 5,023 professors. That number can change. A directory page contains up to 20 professors, and a review page up to 20 reviews. Full initial coverage will require many runs/days; five professors per weekly job is not full weekly coverage.

You can spend a small batch on discovery only:

```bash
npm run ingest -- --discover-only --discover-pages 5 --max-requests 5
```

Discovery automatically resumes its cursor. After a full directory pass, use `--rediscover` occasionally to find new professors; it preserves the queue, request counters, blocks, and saved reviews:

```bash
npm run ingest -- --rediscover --discover-only --max-requests 1
```

`discovery_complete=true` means only that one directory traversal finished. For initial coverage also check `never_imported=0` and `saved_pages=0`. Unresolved courses remain outside rankings. Directory changes during pagination, missing reviews, and inaccessible profiles can prevent exhaustive coverage; these counters are not a completeness guarantee.

## Correct class codes, never guess a missing subject

Examples:

| Source text | Stored canonical code |
| --- | --- |
| `NROSCI0080`, `NROSCI 0080`, nonbreaking-space variant | `NROSCI 0080` |
| `CS1530`, `CS 1530` | `CS 1530` |
| `CS 447` | `CS 0447` |
| `0080` | Same-professor exact-number match only when unique; otherwise private quarantine |

Each imported review has a unique source review ID and retains its original `raw_course`. Courses are unique per school and normalized code; scores belong to a professor/course pair. Identical text under different source IDs is not automatically treated as a duplicate.

`npm run ingest:status` shows recent unresolved IDs and course text, never comment text. After checking the exact professor and class, add an exact review-ID correction to `config/review-course-overrides.json`:

```json
{
  "EXACT_SOURCE_REVIEW_ID": "NROSCI 0080"
}
```

Use actual IDs, not the placeholder. Then apply corrections without any source requests:

```bash
npm run db:backup
npm run ingest:renormalize
npm run ingest:status
```

`config/course-aliases.json` is for verified full-course aliases; their targets must use a supported subject. Do not map a bare `0080` globally. Subject validation is not complete course-catalog verification; plausible but incorrect numbers may still need corrections. Older records without original course text cannot be reliably re-normalized offline.

## Where private data lives

- Primary data: PostgreSQL's Docker named volume, not files in the public web directory.
- Classified review text: `reviews.raw_comment_text`; original labels: `reviews.raw_course`.
- Incomplete imports: private `ingestion_page_cache.payload`.
- Uncertain codes: private `ingestion_quarantine.payload`.
- Public API: allowlisted professor/course metadata, aggregate tags, counts, scores, and source attribution. There is no raw-review viewing endpoint, including for admins.

The migration enables row-level security and removes public/anonymous/authenticated table privileges. The server uses a private owner-level database connection. Database owners/superusers still have access. This is access control, not application-level encryption. Never expose the connection string, database password, service-role key, or `ADMIN_API_KEY` to browser code or classmates. Local PostgreSQL listens only on `127.0.0.1` and uses development-only credentials; use unique secrets and TLS for hosting.

The frontend excludes synthetic database seeds from live results. If the API is unavailable, it labels its built-in preview as DEMO DATA. An empty connected database no longer gets fictional rankings substituted into it.

Completed imports upsert source reviews but do not automatically mirror upstream deletions. Staged pages are deleted after a successful complete professor save; old raw reviews and backups have no automatic retention expiry. Establish a retention/deletion policy before sharing the project more broadly.

## Back up and restore safely

```bash
npm run db:backup
```

This backs up the **local Compose database only**, regardless of any hosted `DATABASE_URL`. It creates a timestamped custom-format PostgreSQL archive and SHA-256 metadata in `data/backups/`, verifies the archive index, and restricts new directories/files to owner access. An incomplete `.partial` file is not a successful backup. Backups include raw reviews and are not encrypted by this script.

Your project is in OneDrive: the backup directory may sync with it. `.gitignore` prevents accidental Git inclusion, not cloud synchronization or public sharing. Keep the project/backups unshared, protect your Mac/cloud account, and retain an encrypted backup outside the Docker volume. Do not upload database dumps with the application source.

Test a restore in a **new empty database**, not over your live database. Replace the filename below with an actual completed `.dump` filename. Use a fresh scratch database name if it already exists:

```bash
docker compose exec -T postgres createdb -U postgres easy_restore_test
docker compose exec -T postgres pg_restore -U postgres -d easy_restore_test --no-owner --no-acl --exit-on-error < "data/backups/ACTUAL-BACKUP.dump"
docker compose exec -T postgres psql -U postgres -d easy_restore_test -c 'SELECT count(*) FROM reviews;'
```

No destructive restore/cleanup command is included. Keep the backup until you have checked restoration. For a hosted database, use the provider's backup/restore procedure or a separately configured `pg_dump` command targeting that database.

## What “all offered courses” requires

RMP is historical student-review coverage. A class without reviews cannot be recovered from it, and a past professor/course pair is not proof of a currently scheduled section.

Semester-specific coverage is deferred by request. Later, select the Pittsburgh campus and desired term in Pitt's official Class Search, include closed sections if “all” means all scheduled classes, and obtain a course/section export through your available university access. Join by canonical subject/number and verified instructor; keep unreviewed classes visible as **no review data**, not score zero. Do not join bare numbers or instructor names alone without resolving ambiguity. See [Pitt's Registrar enrollment resources](https://www.registrar.pitt.edu/enrollment) and [course catalog/class scheduling](https://www.registrar.pitt.edu/faculty-staff/course-catalog-class-section-scheduling).

## Verification commands

```bash
npm test
npm run typecheck
npm run build
```

The seven database integration tests are opt-in and use synthetic inputs, not RMP requests. Create an empty database whose name ends `_test`, run migrations against it, then use:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/easy_ingestion_test npm run db:migrate
DATABASE_URL=postgres://postgres:postgres@localhost:5432/easy_ingestion_test EASY_INTEGRATION_TEST=true RMP_INGESTION_ENABLED=true RMP_TERMS_REVIEWED=true npm test -w @easy-a/api
```

Do not point integration tests at the live database. Tests clean up only their explicitly named synthetic fixtures inside the test database.
