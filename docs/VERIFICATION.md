# Verification

Run the complete repository checks from the project root:

```bash
npm test
npm run typecheck
npm run build
npm run test:syllabus-build -w @easy-a/web
```

The standard test suite uses synthetic fixtures and mocked provider responses. It covers scoring, normalization, public-field filtering, AI output validation, authentication boundaries, student profiles and reviews, personal ranking, catalog access, syllabus parsing, and verification persistence.

## Database integration tests

Integration tests are opt-in. Use only an isolated PostgreSQL database whose name ends in `_test`, then apply migrations before running them. Never point tests at a development or production database.

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/easy_integration_test npm run db:migrate
EASY_INTEGRATION_TEST=true DATABASE_URL=postgresql://postgres:postgres@localhost:5432/easy_integration_test npm test
```

Authentication database tests use their own `AUTH_TEST_DATABASE_URL`. Live provider checks are optional and should use synthetic content, a dedicated key, and the smallest practical scope.

## Release smoke checks

- Confirm the API health endpoint returns successfully.
- Search for a real catalog course and open an offering.
- Confirm raw comments and private identifiers are absent from public responses.
- Verify sign-in, sign-out, account protection, and session persistence.
- Verify summary loading and a syllabus check with non-sensitive test content.
- Confirm the app clearly labels demo fallback data when the API is unavailable.
- Confirm no secrets, exports, backups, or uploaded documents are tracked by Git.
