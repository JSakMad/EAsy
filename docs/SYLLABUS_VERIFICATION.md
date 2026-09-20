# Syllabus-supported review tags

The real Pitt professor/course detail page accepts a signed-in student's PDF or UTF-8 `.txt` syllabus after they have reviewed that exact pairing. LSU and other fictional previews do not accept uploads.

The server fetches the student's review and course/professor identity itself. Files are limited to 2 MB; PDFs must contain extractable text and have at most 30 pages. Text is capped at 100,000 characters. Unsupported formats, scans, unreadable files, and identity mismatches do not create verification records. Ten attempts per student per rolling 24 hours are allowed. Next server actions provide the existing same-origin submission protections and accept up to 3 MB to allow multipart overhead.

Identity checking requires the course code, full course title, and a labeled instructor/professor name near the beginning. Case, whitespace, punctuation, accents, and `&`/`and` differences are normalized. A different primary course code rejects the file. A mismatch or unconfirmed identity opens an accessible dialog explaining that the student may have the wrong class page or syllabus. Abbreviated titles or names can fail conservatively.

Only tags already selected in that student's review are eligible. The deterministic checker recognizes explicit policy declarations (for example, “All quizzes are online.” or “Attendance is optional.”). Contradictory or qualified statements block verification. Unknown wording stays unverified, which is not a finding that a review is false. Group work does not imply a group-project-heavy course, limited retakes do not imply unlimited attempts, and study guides do not imply practice exams. Grades, difficulty, and subjective ease are never verified by a syllabus. No AI service receives the upload.

Check marks on the professor detail page mean **supported by a matching uploaded syllabus**, not official institutional verification or authentication of the file. Checks show their date and expire after 180 days; the UI explains that policies may differ by semester. Only the document SHA-256 fingerprint, supported IDs, check time, checker version, and review relation are retained. Files and extracted text are discarded and are never publicly served. Reuploading a matching document replaces that review's previous checks, including clearing checks when the new document supports no tags. Mismatches leave prior checks intact. Deleting a review/user cascades to its checks. This feature does not change scores or make extra reviews.

## Deployment

Run `npm run db:migrate` against the database used by the web server before deploying. Migration `011_syllabus_verification.sql` creates two private, RLS-enabled tables. No existing course or review data is rewritten. Configure appropriate grants/policies if using a restricted database role instead of the current private owner role. Without the migration, the page stays available and labels syllabus checking temporarily unavailable. Deploy the Next.js application with the updated lockfile and `unpdf` dependency.

The matcher lives in `apps/web/lib/syllabus-check.ts`, parser in `syllabus-file.ts`, and persistence in `syllabus-store.ts`. Increment checker version when rules materially change so older decisions can be excluded. Additional file formats or OCR would require separate support; renaming a file does not convert it.
