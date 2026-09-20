# EAsy

EAsy is a course-first professor comparison platform for University of Pittsburgh students. It separates reported grade outcomes, difficulty, and concrete class-structure signals instead of reducing every experience to a single general professor rating.

The application uses a pre-collected review dataset and a bundled course catalog. It does not treat historical reviews as proof that a course is currently offered. Raw review comments stay private; public endpoints expose only aggregate scores, counts, tags, and summary metadata.

## Features

- Search a course and compare professors who have taught it.
- Filter by class details such as exam format, attendance, curves, and permitted resources.
- See a transparent score built from reported grades, difficulty, and class-structure evidence.
- Sign in with Google, save preferences, and receive a personalized ranking adjustment.
- Submit an EAsy review for a professor/course pairing.
- Upload a syllabus to check whether selected review claims are supported by the document.
- Generate on-demand Groq summaries for course/professor review sets.
- Fall back to clearly labeled demo data when the public API is unavailable.

## Tech stack

- Next.js and React frontend on Vercel
- Express API on Render
- PostgreSQL on Neon
- Better Auth with Google OAuth
- Groq for review summaries and syllabus-assisted verification
- TypeScript, Vitest, and npm workspaces

## Repository layout

```text
apps/web       Next.js application
apps/api       Express API, database access, and background processing
packages/core  Shared scoring, tags, and course normalization
config         Bundled catalog and classification rules
database       PostgreSQL migrations
docs           Current setup and architecture notes
```

## Run locally

Requirements: Node.js 22+ and PostgreSQL 15+, or Docker Desktop.

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Copy `.env.example` to `.env`. For authentication and syllabus AI, also place the required server-only values in `apps/web/.env.local`.

3. Start PostgreSQL and apply migrations:

   ```bash
   docker compose up -d
   npm run db:migrate
   ```

4. Import the bundled course catalog:

   ```bash
   npm run catalog:import
   ```

5. Start the web and API workspaces:

   ```bash
   npm run dev
   ```

Open `http://localhost:3000`. The API health check is available at `http://localhost:4000/health`.

The local database starts empty. `npm run db:seed` adds synthetic development fixtures, while the website's built-in fallback remains visibly labeled as demo data.

## Environment

The main settings are documented in `.env.example`.

- `DATABASE_URL` and `DATABASE_SSL` configure PostgreSQL.
- `WEB_ORIGIN` and `NEXT_PUBLIC_API_URL` connect the two applications.
- `BETTER_AUTH_*` and `GOOGLE_*` configure Google sign-in.
- `GROQ_API_KEY` enables AI overviews and syllabus checks from server code only.
- `ADMIN_API_KEY` protects administrative API routes.

Never commit `.env`, database exports, uploaded documents, raw review data, or credentials.

## Verification

```bash
npm test
npm run typecheck
npm run build
npm run test:syllabus-build -w @easy-a/web
```

Database integration tests are opt-in and must use a dedicated database whose name ends in `_test`.

## Deployment

Deploy `apps/web` to Vercel, the Express service through `render.yaml`, and PostgreSQL on Neon. Apply all migrations to the hosted database and import the bundled catalog before launch. Configure `NEXT_PUBLIC_API_URL` with the Render URL and `WEB_ORIGIN` with the Vercel origin.

See [team setup](TEAM_SETUP.md), [architecture](docs/ARCHITECTURE.md), [authentication](docs/AUTHENTICATION.md), [AI overviews](docs/AI_OVERVIEWS.md), and [data handling](docs/LEGAL_AND_DATA.md) for operational details.

## Scoring

The base EAsy score combines self-reported A/A− outcomes, inverted difficulty, and distinct class-structure signals. Missing grades are excluded from the grade denominator, and offerings with too little evidence show an insufficient-data state. Signed-in students can optionally apply a bounded preference adjustment. This is a comparison tool, not a predicted grade or guarantee.

## Team Members

Joshua Sakolsky-Madaras - JSakMad7@gmail.com
Gabe Zuccolotto - gabezuccolotto@gmail.com
