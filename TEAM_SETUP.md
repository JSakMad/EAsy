# Team setup

EAsy is an npm workspace. Clone the entire repository so the web app, API, shared core package, migrations, configuration, and lockfile remain together.

Never share `.env`, production database credentials, OAuth secrets, Groq keys, uploaded documents, raw review data, or database backups.

## Frontend development with the hosted API

Requirements: Git and Node.js 22+.

```bash
npm ci
npm run build -w @easy-a/core
```

Create `apps/web/.env.local` with the public API URL:

```dotenv
NEXT_PUBLIC_API_URL=https://YOUR-API.onrender.com
```

Then run:

```bash
npm run dev -w @easy-a/web
```

The production API must allow `http://localhost:3000` in `WEB_ORIGIN`. This workflow does not grant database or administrative access.

## Isolated full-stack development

Copy `.env.example` to `.env`, configure a local-only `ADMIN_API_KEY`, and set `apps/web/.env.local` to use `http://localhost:4000`.

```bash
npm ci
docker compose up -d
npm run db:migrate
npm run catalog:import
npm run dev
```

The local database is independent of production. Use the synthetic seed command or labeled demo fallback for development. Groq-backed features require a teammate's own server-only key; ordinary interface work does not.

## Deployment handoff

- Vercel hosts `apps/web`. Enable access to files outside the root directory so the shared workspace can build.
- Render hosts the Express API from `render.yaml`.
- Neon hosts PostgreSQL.
- Apply every migration and import the bundled catalog against the intended hosted database.
- Configure `DATABASE_URL`, `DATABASE_SSL`, `WEB_ORIGIN`, `NEXT_PUBLIC_API_URL`, and the required server-only secrets in their respective hosts.

Before a presentation, verify the API health endpoint, a real course search, an offering page, sign-in behavior, CORS, and AI summary behavior. A free Render instance may need to wake before the frontend receives a response.

## Collaboration

Work on branches, submit pull requests, and keep unrelated changes separate. Run the repository verification commands before merging:

```bash
npm test
npm run typecheck
npm run build
npm run test:syllabus-build -w @easy-a/web
```

See [authentication](docs/AUTHENTICATION.md), [course reviews](docs/COURSE_REVIEWS.md), [personal scoring](docs/PERSONAL_SCORING.md), [AI overviews](docs/AI_OVERVIEWS.md), and [syllabus verification](docs/SYLLABUS_VERIFICATION.md) for feature-specific setup.
