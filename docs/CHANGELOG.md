# Project change log

Record teammate-facing changes by date, including migration/configuration steps and links to verification. Git history records the exact author and commit time once changes are committed.

## 2026-09-19 — Google OAuth accounts

- Added Google account creation/sign-in, a server-protected account page, header account navigation, and session revocation on sign-out.
- Added Better Auth and PostgreSQL support to the Next.js server. Added migration `007_auth_accounts.sql` for users, provider identities, sessions, OAuth verification state, and shared rate limiting.
- Added server-only OAuth environment settings; web deployments now require database access to enable accounts. Existing public course browsing remains available without auth configuration.
- Added automated auth checks and the Google browser verification procedure. See [verification results](VERIFICATION.md).
- Added [authentication setup and maintenance documentation](AUTHENTICATION.md); updated the architecture, README, teammate setup, and account-data notes.
- Removed `docs/` from `.gitignore` so project documentation can be tracked and reviewed with implementation changes. Existing local documentation is now eligible for Git tracking.

Deployment action: configure the Google OAuth client and web environment, apply migration 007, and complete the browser verification before enabling accounts for users. No production database migration or deployment was performed as part of this change.
