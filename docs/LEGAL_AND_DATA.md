# Data handling and provenance

EAsy uses a pre-collected course-review dataset and a bundled course catalog. Historical review coverage is not an official schedule and does not prove that a class or instructor pairing is currently offered. Student-submitted EAsy reviews are stored separately from imported records.

Before publishing or redistributing a dataset, confirm that its license and source terms allow the intended use. Keep a private record of the dataset source, license or permission, and any required attribution. Do not claim that a third party collected the data unless that provenance is documented.

This document is an engineering summary, not legal advice.

## Public and private data

Public course endpoints expose aggregate scores, counts, tags, catalog details, and summary metadata. They do not return raw imported comments, source identifiers, staging data, quarantine records, student account data, or uploaded files.

Private PostgreSQL tables use restricted privileges and row-level security where applicable. Database owners and privileged server connections still have access, so database credentials must remain secret and backups must be protected.

## Accounts

Google sign-in stores a user's basic profile, provider identity, encrypted provider tokens, and session/device metadata in private auth tables. Account data is excluded from public course responses. Publish an accurate privacy notice and deletion contact before public launch, and establish procedures for account deletion, token revocation, retention, and backup deletion.

## AI processing

Review summaries send a bounded, redacted sample of comments to Groq. Syllabus verification sends redacted extracted document text and selected claims. Uploaded syllabus files are not publicly served and are discarded after processing; the application retains only the fingerprint and verification result described in [syllabus verification](SYLLABUS_VERIFICATION.md).

Redaction reduces obvious contact details but is not complete anonymization. Configure the provider's data controls for the project and disclose the transfer in the product privacy notice.

## Operational safeguards

- Keep `.env`, database exports, uploaded files, and raw review data out of Git.
- Use server-only environment variables for database, OAuth, Groq, and administrative credentials.
- Apply least-privilege database grants and encrypted transport in hosted environments.
- Restrict backups, test restores in an isolated database, and define a retention schedule.
- Treat AI summaries and syllabus checks as assistive signals rather than guarantees.
- Keep the public methodology honest about sample sizes, missing data, and historical coverage.
