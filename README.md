# EAsy

**Accounts added September 19, 2026:** users can create an account and sign in with Google. See [authentication setup](docs/AUTHENTICATION.md) for the free OAuth integration, migration 007, web server environment settings, and testing. Teammate-facing changes are dated in [the change log](docs/CHANGELOG.md).

For teammate onboarding and the current Vercel + Render + Neon deployment plan, see [Team setup](TEAM_SETUP.md). The older Supabase walkthrough below is an alternative, not the current deployment target.

Professor/course pages now support **on-demand Groq AI overviews with a 30-day cache and sampled-review dates**. Set the server-only `GROQ_API_KEY` in `.env`, remain on Groq's Free plan, and apply migrations. See [AI overview setup](docs/AI_OVERVIEWS.md) for privacy, request budgets, and hosting notes. No Ollama or manual generation is needed for the website.

Course labels now use the supplied 216-subject vocabulary, verified aliases, and conservative same-professor matching. See [subject normalization and cleanup](docs/SUBJECT_NORMALIZATION.md) for audit details and the no-write preview command.

Find a course first, then compare its professors by EAsy score. Search accepts codes with or without spaces and compares the same course across professor departments. The interface includes 31 grouped class-detail tags and reduced-motion-aware entrance animations.

After updating an existing installation, run `npm run db:backup`, `npm run db:migrate`, and `npm run ingest:retag`. Retagging uses saved reviews only: it does not scrape, change course assignments, or reset import progress. See [the September update notes](docs/EASY_UPDATE.md).

A Pitt-only course/professor ranking platform. It separates reported grade outcomes, difficulty, and concrete class-structure signals instead of blending them into a general professor rating. Imported reviews describe historical experiences, not verified current-semester availability.

For the current Mac/Docker setup, resumable school-wide imports, private backups, and course-code corrections, start with [docs/SCRAPER_SETUP.md](docs/SCRAPER_SETUP.md).

The repository contains:

- a responsive Next.js frontend with browse, search, sorting, AND-style tag filters, offering detail pages, sample-size warnings, and a visible v1 methodology;
- an Express REST API that never returns raw review comments;
- a PostgreSQL schema with deduplicated source IDs and historical score snapshots;
- a replaceable `IngestionSource` interface and an opt-in, serial, rate-limited RMP GraphQL implementation;
- configurable course aliases and tag phrase/regex rules;
- unit and API tests; and
- a weekly GitHub Actions refresh job.

## Important legal safeguard

Rate My Professors' [Terms of Use](https://www.ratemyprofessors.com/terms-of-use) restrict scraping. Fresh installations require two explicit environment flags to enable ingestion. Keeping review text private does not resolve source ownership or terms restrictions. No request rate guarantees continued access. See [docs/LEGAL_AND_DATA.md](docs/LEGAL_AND_DATA.md).

## Run locally

Requirements: Node.js 20+ and PostgreSQL 15+ (or Docker Desktop).

1. Copy `.env.example` to `.env` and keep the local database values as supplied.
2. Create `apps/web/.env.local` with:

   ```text
   NEXT_PUBLIC_API_URL=http://localhost:4000
   ```

3. Install packages:

   ```bash
   npm install
   ```

4. Start PostgreSQL and create the schema:

   ```bash
   docker compose up -d
   npm run db:migrate
   ```

5. Start both services:

   ```bash
   npm run dev
   ```

Open `http://localhost:3000`. The API health check is at `http://localhost:4000/health`.

If the API is unavailable, the frontend opens with visibly labeled in-app demo data. A connected but empty database shows no imported offerings. The optional `npm run db:seed` writes synthetic fixtures, which are excluded from the live API.

## Tests and production build

```bash
npm test
npm run typecheck
npm run build
```

## Free-tier hosting

The deployment sequence below follows the requested Vercel + Render + Supabase + GitHub Actions layout.

### 1. Database on Supabase

1. Create a Supabase project on the Free plan.
2. Open **Project Settings → Database** and copy the pooled PostgreSQL connection string.
3. Locally set `DATABASE_URL` to that string and `DATABASE_SSL=true`, then run `npm run db:migrate` once.
4. Optionally run `npm run db:seed` for the labeled preview data. Skip it when you are ready to ingest permitted source data.

The Free plan currently includes a 500 MB database and pauses projects after one week of inactivity, so confirm current limits before launch: [Supabase pricing](https://supabase.com/pricing).

### 2. API on Render

1. Push this folder to a GitHub repository.
2. In Render, choose **New → Blueprint**, connect the repository, and select the included `render.yaml`.
3. Enter `DATABASE_URL` when prompted. Set `WEB_ORIGIN` to the Vercel address after the frontend is created (multiple origins may be comma-separated).
4. Leave both RMP opt-in variables false unless you have completed the legal review described below.

Render's Free web service sleeps after 15 minutes without traffic and can take about a minute to wake; that is expected for this hobby deployment: [Render free-service documentation](https://render.com/docs/free).

### 3. Frontend on Vercel

1. Import the same GitHub repository into Vercel.
2. Set the project **Root Directory** to `apps/web`; Vercel detects Next.js.
3. Add `NEXT_PUBLIC_API_URL=https://YOUR-API.onrender.com`.
4. Deploy, then copy the resulting `*.vercel.app` URL back into Render's `WEB_ORIGIN` value and redeploy the API.

Vercel's free Hobby plan is for personal, non-commercial projects, which matches this project's stated use: [Vercel Hobby plan](https://vercel.com/docs/plans/hobby).

### 4. Weekly refresh on GitHub Actions

The workflow runs Sunday at 08:17 UTC and processes professors serially. Each run prioritizes professors never imported before, then refreshes the oldest data, so a conservative batch still progresses through the school.

1. In GitHub **Settings → Secrets and variables → Actions**, add repository secret `DATABASE_URL`. It must be a reachable hosted database, not your Mac's localhost address. Use the same database for all workers so they share locks and limits. No contact email is sent to RMP.
2. Only after the terms/permission review, add repository variables `RMP_INGESTION_ENABLED=true` and `RMP_TERMS_REVIEWED=true`.
3. The workflow is capped at 5 complete professors and 50 requests per run, with a shared 200-request UTC-day cap. A weekly batch is not a weekly refresh of every Pitt professor. Use the setup guide for initial coverage and progress checks.
4. Run **Weekly data refresh → Run workflow** once manually before relying on the schedule.

Actions use is free on standard GitHub-hosted runners for public repositories; private repositories receive an account quota: [GitHub Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage).

## Manual single-professor refresh

Use the protected API endpoint with either a numeric RMP professor ID or its Relay ID:

```bash
curl -X POST "https://YOUR-API.onrender.com/admin/ingest/professors/123456" \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY"
```

This endpoint follows the same ingestion opt-ins and rate limit as the scheduled job.

## Configuration points

- `config/tags.json`: labels and trigger regex patterns.
- `config/course-aliases.json`: Pitt-specific course-name/code cleanup.
- `config/review-course-overrides.json`: verified corrections keyed by exact source review ID; ambiguous numeric codes are never guessed globally.
- `packages/core/src/index.ts`: the explicit 50% grade / 35% difficulty / 15% tag formula.
- `.env.example`: all runtime settings.

## API routes

- `GET /schools/1247/departments`
- `GET /departments/:id/offerings?sort=easy_a_score&tags=online_exams,notecard_allowed`
- `GET /offerings/:id`
- `GET /offerings/:id/tags`
- `POST /admin/ingest/professors/:rmpProfessorId`

Full raw comments remain in the private database solely for extraction. Public endpoints return only aggregate tags, counts, scores, and an attribution link to the original professor page.
