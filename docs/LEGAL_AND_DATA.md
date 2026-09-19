# Legal and data-source notes

## Account data (added 2026-09-19)

Google sign-in stores a user's basic profile, provider identity, encrypted OAuth tokens, and session/device metadata in private PostgreSQL auth tables. Account data is not included in public course API responses. Backups now also contain account information. Before public launch, publish an accurate privacy notice and deletion contact and establish retention/backup deletion procedures. See [AUTHENTICATION.md](AUTHENTICATION.md) for stored fields and operator deletion/revocation behavior.

This is an engineering safeguard summary, not legal advice.

## Current source risk

Rate My Professors' current Terms of Use say users may not use automated tools to scrape or crawl the site without prior permission. They also restrict collecting and reproducing posted material. Read the primary source before every production enablement: [Rate My Professors Terms of Use](https://www.ratemyprofessors.com/terms-of-use).

The public site identifies the University of Pittsburgh as legacy school ID `1247`: [Pitt on Rate My Professors](https://www.ratemyprofessors.com/school/1247).

The ingestion adapter uses the site's observed GraphQL endpoint and Relay IDs; this is not a supported or licensed public API. The integration can change or stop at any time.

## Safeguards implemented

- fresh installations disable ingestion unless `RMP_INGESTION_ENABLED=true` and `RMP_TERMS_REVIEWED=true` are supplied;
- the default delay is 5,000 ms (configuration floor 2,500 ms), and requests are serial;
- the User-Agent identifies EAsy and its personal research purpose; it sends no contact email or account cookies;
- per-run and UTC-day request caps, locks, cooldowns, completed checkpoints, and partial pages persist in PostgreSQL;
- 429 stops without retry for at least 24 hours or a longer Retry-After; access denials/challenges block imports pending review;
- v1 is hard-scoped to school ID `1247`;
- raw comments are selected by no public API query; positive response allowlists exclude them even if internal query results gain private fields;
- raw reviews, staging, and quarantine have row-level security enabled and public/client-role privileges revoked; privileged database owners still have access;
- private backups are available, but neither raw storage nor dump files are encrypted by the application;
- public detail pages link to RMP for attribution; and
- `IngestionSource` allows a licensed export, manual collection, or student submission source to replace RMP without changing scoring or API code.

## Recommended production decision

Keeping reviews private or displaying only derived statistics does not grant ownership, a license, or an exemption from the source's terms. Noncommercial use and other people's scraping are not guarantees of permission. Rate limits cannot guarantee that an account or IP will not be blocked. Seek permission or advice appropriate to your intended use. Do not expose the database service key or `ADMIN_API_KEY` in the browser.

The local operator has chosen to enable ingestion. See [SCRAPER_SETUP.md](SCRAPER_SETUP.md) for the exact operating limits, access controls, unresolved-course handling, backups, and coverage limitations. RMP reviews are not Pitt's authoritative current course schedule.
