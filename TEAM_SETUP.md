# Teammate setup

Course catalog and student reviews require migration `010_catalog_student_reviews.sql` and `npm run catalog:import` against your shared API/web database. Deploy the API and website together. See [course-review setup](docs/COURSE_REVIEWS.md).

Personal scoring requires migration `009_class_preferences.sql`. Pull the latest code, install dependencies, and run `npm run db:migrate` against the same database configured in `apps/web/.env.local`. See [personal scoring](docs/PERSONAL_SCORING.md).

Account support added **2026-09-19**: follow [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) for Google OAuth credentials, web database settings, migration 007, and verification. Frontend-only browsing still works without account configuration. See [docs/CHANGELOG.md](docs/CHANGELOG.md) for dated changes.

Clone or download the entire repository, not just the frontend folder: this is an npm workspace and needs the shared core package, root configuration, and lockfile.

The deployed website is for using EAsy; the GitHub repository is for editing it.
Share the repository URL and invite teammates as collaborators if it is private.
Never send your `.env`, production database credentials, Groq key, or database backups in GitHub issues or chat.

## Local development with the hosted data

Requirements: Git and Node.js 22. Clone the repository, then run these commands from its root:

```bash
npm ci
npm run build -w @easy-a/core
```

Create `apps/web/.env.local` containing the deployed API URL (not a secret):

```dotenv
NEXT_PUBLIC_API_URL=https://YOUR-API.onrender.com
```

Run:

```bash
npm run dev -w @easy-a/web
```

Open http://localhost:3000. No database password or Groq key is needed for this frontend-only workflow. The production API must allow `http://localhost:3000` in `WEB_ORIGIN` for browser requests. This mode reads hosted data and summary requests use the shared production AI budget. It does not grant database/admin access.

## Isolated full-stack development

Use Docker Desktop, copy `.env.example` to `.env`, and configure a new local-only `ADMIN_API_KEY`. Set `apps/web/.env.local` to `NEXT_PUBLIC_API_URL=http://localhost:4000`.

```bash
npm ci
docker compose up -d
npm run db:migrate
npm run dev
```

The local database starts empty and is independent of production. Synthetic seed records are excluded from live API results; the website's labeled demo fallback is available when the API is unavailable. Do not enable ingestion merely to get development data. Coordinate an approved fixture dataset instead. Groq summaries require a teammate's own server-only key for this isolated setup; ordinary development does not require one.

## Deployment handoff

Deploy from a reviewed private GitHub repository first. Vercel hosts `apps/web`; Render hosts the Express API using `render.yaml`; Neon hosts PostgreSQL. Use free plans, and check database size against the current Neon allowance before migration. Back up the existing database before copying it; keep backups outside Git.

Vercel: set Root Directory to `apps/web`, enable access to files outside the root directory for workspace dependencies, and set `NEXT_PUBLIC_API_URL` to the Render HTTPS URL. The web workspace's prebuild builds the core workspace.

Render: set `DATABASE_URL` to the Neon connection string, `DATABASE_SSL=true`, `WEB_ORIGIN` to the actual Vercel origin (plus localhost for teammate frontend development), and the server-only `GROQ_API_KEY`. Keep both ingestion opt-ins false. Run migrations against the hosted database securely before exposing the app; do not put credentials into command text or commit files containing them.

Before launch, verify the API health endpoint, real course results (not fallback demo data), an offering page, CORS, and summary behavior. Free Render cold starts can exceed the frontend's five-second fetch timeout and show the labeled demo fallback; wake the API and reload before a presentation. Local data does not automatically sync with Neon.

Share these with teammates after launch:

- The live Vercel URL.
- The GitHub repository URL and collaborator invitation.
- The public Render API URL.
- This guide and the requirement to work on branches and submit pull requests.

Keep raw reviews and exports out of the repository. Public aggregate API access is not a public database login or permission to redistribute source reviews. Disclose the dataset's actual provenance and pre-existing project work in a hackathon submission; removing collection code does not change either.
