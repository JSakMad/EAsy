# Syllabus-supported review tags

Pitt professor/course pages accept PDF, Word (.docx and legacy .doc), and UTF-8 .txt syllabuses from signed-in students who reviewed that exact pairing. LSU previews do not accept uploads.

## Extraction and AI checks

PDF text is extracted with unpdf. Word text is extracted with word-extractor, including body text, headers, footers, footnotes and text boxes, without running Word or executing document macros. DOCX ZIPs are validated before extraction: at most 1,000 entries and 10 MB actual inflated content; encrypted or macro-bearing archives are rejected. File signatures are checked. Files are limited to 2 MB, PDFs to 30 pages, and extracted text to 100,000 characters. Scanned images and encrypted documents are unsupported.

The web server calls the existing Groq chat completions API using qwen/qwen3.8-27b, the same provider/model as course overviews. It sends the full extracted syllabus, expected course/professor identity, and only the student's reported preferences and their specific tags. Recognized email addresses, phone numbers and web URLs are redacted first. The full redacted text must fit within 48,000 UTF-8 bytes; longer documents are rejected, never silently truncated. No student account details, review comments, grades, or uploaded binary files are sent.

A strict JSON schema asks for supported/contradicted/unknown identity and claim findings, each with verbatim supporting passages. The document is explicitly untrusted data and cannot give the model instructions or tools. The server checks completion status, schema fields, exact claim IDs, unique and complete results, and that every quoted passage exists in the supplied text. Positive identity needs evidence of both the actual course code and the professor's name. Unknown or conflicting identity opens the mismatch dialog. Unsupported and ambiguous policies stay unverified. Broad preferences do not automatically verify their stronger specific tags (retakes are not unlimited retakes; group work is not group-project-heavy).

There is one provider request per attempt, a 25-second timeout, a 4,096-token output cap, and no retries, paid fallback, alternate providers or rule-based fallback. Missing credentials, quota, timeouts, malformed output and invented quotes do not save new checks or overwrite existing ones. Ten attempts per authenticated user per rolling 24 hours are allowed. The existing server-action origin protections apply.

## Meaning and storage

Check marks mean supported by a matching uploaded syllabus, not official institutional verification or authentication. Neither AI nor document parsing proves that a file is genuine. Grades and difficulty are not verified. Semester policies can vary; checks expire after 180 days.

Only the document SHA-256 fingerprint, supported IDs, check time, checker version, and review relation are retained by EAsy. The file and text are discarded; they are not publicly served. Groq processes the submitted redacted text under its service policies. The upload UI discloses this transfer. Reuploading a matching document replaces that review's checks, including clearing checks if no claims are supported. Review/user deletion cascades to the evidence. Scores are unchanged.

Checker version 2 denotes Groq-based checks. Version 1 rule-based records are preserved in the database but no longer display check marks; students can reupload to run the AI check.

## Deployment

PDF standard fonts and character maps come from the bundled pdfjs-dist assets. The server reads them from disk, and Next.js output tracing includes them with the offering routes for Vercel/standalone deployment. No font CDN or additional environment variable is needed.

After building, run `npm run test:syllabus-build -w @easy-a/web` to load the compiled upload action and check deployment assets. Runtime package resolution must bypass Turbopack rewriting: a successful build and source-level tests alone do not catch numeric module IDs being used as filesystem paths.

Set the existing server-only GROQ_API_KEY in apps/web/.env.local for local development and in the Next.js/Vercel production environment. The Render/API key alone is not visible to Next.js. Never use a NEXT_PUBLIC variable for this key. Local configuration was updated to use the existing project key.

No new migration is required for the AI/Word update. Migration 011_syllabus_verification.sql from the original upload feature must already be applied with npm run db:migrate. It creates private, RLS-enabled verification and upload-attempt tables; configure grants/policies for restricted roles if needed. Deploy the web app with the updated lockfile. The API service does not need code changes for this update.

Implementation: syllabus-ai.ts validates provider results, syllabus-file.ts and syllabus-word.ts parse files, and syllabus-store.ts persists checks. Tests include real PDF/DOCX/DOC extraction, archive limits, invented evidence, identity rejection, malformed provider output, quota, authentication and persistence. An opt-in RUN_SYLLABUS_GROQ_LIVE=true test checks synthetic documents through the real provider; ordinary tests do not call Groq.
