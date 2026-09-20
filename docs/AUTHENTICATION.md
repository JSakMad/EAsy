# Accounts and Google sign-in

EAsy uses the open-source Better Auth library with Google OAuth / OpenID Connect and the existing PostgreSQL database. No paid authentication service or subscription is required for this implementation. Database and hosting usage still count toward your hosting plan. Google is the only enabled provider; email/password registration is disabled.

## User experience

- Students review class-preference checkboxes during setup. Apply migration `009_class_preferences.sql` as well. Personal scores replace the displayed review-based score for signed-in students; see [personal scoring](PERSONAL_SCORING.md) for the formula and data limitations.

- After Google sign-in, new and existing users without a student profile must confirm their name and enter their year of schooling and major at `/account/setup`. Signed-in account, course browsing, and offering pages enforce this on the server. Anonymous browsing remains public.
- `/account` shows the saved details and links to **Edit profile**. The name starts with the Google-provided value but must be submitted with the other required fields. Students may enter **Undeclared** as their major.
- Apply migration `008_student_profiles.sql` with `npm.cmd run db:migrate` before running this version. The web database role also needs SELECT/INSERT/UPDATE on `auth_student_profile`; the migration revokes PUBLIC access. Profiles are private, linked to the authenticated user, and deleted automatically when that user is deleted.

- Choose **Sign in** in the header, then **Continue with Google**. The first successful authorization creates the EAsy user and associated Google identity; later sign-ins reuse that identity.
- `/account` displays the signed-in user's name, email, and account creation date. The server validates the session before rendering any profile information.
- **Sign out** revokes the current database session and clears its cookie. Other devices keep their own sessions.
- Browsing courses is public. Signing in does not grant ingestion, administrator, or private review access.
- Cancellation and provider errors return to the sign-in page with a retry message. Missing configuration disables sign-in while public browsing continues to work.

## Local setup

1. Install dependencies with `npm ci` using Node.js 22.
2. Start your isolated PostgreSQL database and run `npm run db:migrate` from the repository root. Migration `007_auth_accounts.sql` creates the auth tables. The existing migration runner records its filename and application timestamp in `schema_migrations` and skips it on later runs.
3. In [Google Cloud Console](https://console.cloud.google.com/), create a project and configure Google Auth Platform branding, audience, and a **Web application** OAuth client. For an app in Testing, add each teammate as a test user when required by Google's audience settings.
4. Register `http://localhost:3000` as an authorized JavaScript origin and `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI. The callback must match exactly.
5. Create `apps/web/.env.local` using the template below. The API/migration runner uses root `.env`; Next.js uses the web workspace's environment files. Use the same isolated database in both files.

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/easy_a_finder
DATABASE_SSL=false
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=YOUR_GENERATED_RANDOM_SECRET
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
```

Generate a secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Keep it private and stable across application instances and restarts. Do not use the placeholder above. Secrets and database credentials must never use a `NEXT_PUBLIC_` prefix or be committed.

6. Run `npm run dev` and exercise the manual checks below. Frontend-only teammates can omit auth configuration and continue browsing.

## Deployment

The Next.js server needs a database connection in addition to the Express API. On Vercel, set `DATABASE_URL`, `DATABASE_SSL=true`, `BETTER_AUTH_URL=https://YOUR-STABLE-WEB-DOMAIN`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` as server environment variables. Keep `NEXT_PUBLIC_API_URL` pointing to Render. The PostgreSQL connection validates TLS certificates; use your provider's verified TLS connection settings.

Apply migration 007 securely before enabling sign-in, then restart/redeploy the web app. The web database role needs SELECT/INSERT/UPDATE/DELETE on the five `auth_*` tables and no raw review privileges. A database owner can run the migration; a separate restricted web role is recommended. All auth table access is revoked from PostgreSQL PUBLIC. Use a provider connection pool URL for serverless deployment and account for up to five connections per warm web instance.

Register the exact production callback `https://YOUR-STABLE-WEB-DOMAIN/api/auth/callback/google` in Google. Use separate OAuth clients/secrets and a separate database for development and production. Do not wildcard preview domains into trusted origins; previews need their own explicit configuration. Complete Google's publishing requirements for external users, including accurate app branding and privacy information. Never paste credentials into issues or pull requests.

## Implementation and security boundaries

- `apps/web/lib/auth.ts` lazily initializes the server-only Better Auth instance and connection pool. Configuration is validated at request time so builds and public browsing do not require credentials.
- `/api/auth/[...all]` handles Google authorization/callbacks and session APIs in the Node.js runtime on the web origin. Better Auth handles OAuth state, PKCE, cookie signing, origin/CSRF checks, and token validation. Those protections are not disabled.
- Sessions live in `auth_session`, expire after seven days, and refresh after one day of activity. Cookie caching is disabled so revocation and expiry are checked against the database. Cookies are HttpOnly, SameSite=Lax, and Secure in production.
- OAuth identities use a unique `(providerId, accountId)` pair. Automatic linking to a same-email identity is disabled. Google requests only its default basic identity scopes; no Gmail, Drive, or Calendar access is requested. Provider tokens are encrypted before storage.
- `auth_user` stores name, email, verification status, optional profile image URL, and timestamps. `auth_account` stores the provider identity and encrypted OAuth tokens. `auth_session` also stores device/IP metadata; `auth_verification` stores temporary OAuth state. `auth_rate_limit` shares request counters across web instances.
- Rate limiting is enabled in all environments, with stricter limits on social sign-in. Deploy behind a proxy that supplies trustworthy client IP headers; do not expose a server accepting spoofed forwarding headers directly.
- Profile rendering uses server session validation; header session state is only navigation UI. Future private APIs must validate the session server-side and check resource ownership. The Express API does not accept this session as administrator authorization.
- Treat database backups as private account data. Operators can revoke a user's sessions by deleting their `auth_session` rows; deleting `auth_user` cascades to accounts and sessions. This version does not provide a self-service deletion UI. Establish a user-facing deletion contact and retention policy before a public launch. Periodically remove expired sessions/verification rows and stale rate-limit rows according to that policy.

## Verification

Run `npm run typecheck`, `npm test`, and `npm run build`. Auth-specific tests cover configuration, route failure handling, server access checks, and sign-in/sign-out UI errors. See [VERIFICATION.md](VERIFICATION.md) for execution results and limitations.

The PostgreSQL auth tests run only when `AUTH_TEST_DATABASE_URL` is set to a **localhost database whose name ends in `_test`**. They create and remove a randomly named test schema and never load the root `.env` connection. Example PowerShell setup:

```powershell
docker run --detach --rm --name easy-auth-verification --publish 127.0.0.1:55439:5432 --env POSTGRES_DB=easy_auth_test --env POSTGRES_USER=easy_test --env POSTGRES_PASSWORD=local-test-only postgres:16-alpine
$env:AUTH_TEST_DATABASE_URL = 'postgresql://easy_test:local-test-only@127.0.0.1:55439/easy_auth_test'
npm run test -w @easy-a/web
docker stop easy-auth-verification
Remove-Item Env:AUTH_TEST_DATABASE_URL
```

Wait for PostgreSQL to be ready before running the tests. The example password is for this disposable localhost-only database. On macOS/Linux, export the same `AUTH_TEST_DATABASE_URL`, run the tests, and unset it afterward. These tests mock only Google's network responses; they exercise actual callback, account, and session persistence against PostgreSQL. They complement the live Google browser check below.

With a configured Google client and migrated database:

1. Visit `/account` in a private browser window: it must redirect to `/sign-in` without exposing profile data.
2. Sign in with a test Google account. Confirm `/account` renders the correct profile and exactly one user/provider identity was created.
3. Sign out, verify `/account` redirects again, and confirm replaying the former session cookie does not restore access.
4. Sign in again with the same Google account; verify the user ID and creation date are unchanged. A second Google identity should receive a different user ID.
5. Cancel consent and retry. Check the retry message and successful recovery. A callback with missing/invalid state must not create a session.
6. In production, inspect the session cookie's HttpOnly, Secure, and SameSite attributes. Try an untrusted Origin on a sign-in/sign-out POST; it must be rejected.
7. Expire a test session in the database and reload `/account`; access must be denied. Verify two browser sessions remain independent when one signs out.
8. Stop the database or remove a required variable in isolated development. Confirm sign-in fails safely and course browsing remains available.

## References

- [Better Auth Google setup](https://better-auth.com/docs/authentication/google)
- [Next.js integration](https://better-auth.com/docs/integrations/next)
- [Database schema](https://better-auth.com/docs/concepts/database)
- [Security and session options](https://better-auth.com/docs/reference/options)
- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
