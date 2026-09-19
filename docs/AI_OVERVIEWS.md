# EAsy: on-demand Groq summaries

The website now uses Groq's `qwen/qwen3.8-27b` model instead of Ollama. The server loads `GROQ_API_KEY` from `.env`; the key is never included in browser code, model request bodies, logs, or public API responses. The actual `.env` was not displayed or edited during this update.

## Run it

With Docker Desktop running, from the EAsy project folder:

```bash
docker compose up -d
npm run db:migrate
npm run dev
```

Open http://localhost:3000 and select a professor for a course. A missing or expired overview loads automatically while the page remains usable. No Ollama or manual generation command is needed. Restart an already-running API after changing `.env`.

On another installation, place `GROQ_API_KEY=your_private_key` in the actual `.env` or API host's secret environment settings. Never put it in `.env.example`, Git, chat, or `NEXT_PUBLIC_*` variables.

## Monthly cache

- One cache per exact professor/course pairing, reused for 30 days. New imports within that period do not trigger another model call; the card notes that the database changed.
- First visit after 30 days requests a refresh, even if no new reviews arrived. Failed refreshes retain the old summary with an explicit age warning.
- Deleted/moved sampled reviews hide the old summary; this privacy exception can require regeneration earlier than 30 days. Invalid cache content is never shown.
- Server rendering, link prefetch, and `GET /offerings/:id/overview` only read. A mounted detail-page component sends `POST /offerings/:id/overview/generate` with `{}`. Visitors cannot supply evidence, a prompt, model, or force-refresh flag.
- A PostgreSQL lock prevents overlapping provider calls across processes. Budgets and failure cooldowns persist across restarts. At least three usable reviews are required; demo pages never call Groq.
- The browser makes at most three generation-endpoint requests per mount for busy/short-cooldown states. Provider failures do not cause retry loops; revisit later to retry.

Migration 006 adds `offering_cloud_overviews` and `overview_api_budget`. Cached metadata includes sample IDs/dates, generation time, model/version, and cooldowns, but does not duplicate review text. Both tables have RLS enabled and public/anonymous access revoked. The old local cache is preserved separately, not presented as a new Groq result.

## Review sampling and summary quality

Selection starts with the five newest reviews, then interleaves remaining harder, easier, and middle-difficulty reports in recency order. At most 30 reviews are used, but the request-size cap can make samples considerably smaller. Empty comments are skipped; common URLs, emails, and phone numbers are redacted. Long comments are excerpted and the UI reports the excerpt count. This is not full anonymization.

Messages plus response schema are limited to 6,500 UTF-8 bytes, with output capped at 1,000 tokens. This is a conservative size bound, not an exact tokenizer. The provider's actual limits remain authoritative.

The card shows sampled count versus total stored count. Date range and recency counts describe the sample actually submitted, not all database reviews. Dates are computed in code, not by the model; missing, invalid, and future dates cannot establish current policies.

The exact prompt is in `apps/api/src/overview/groq.ts`. It preserves the current sections, treats reviews as untrusted evidence, requests balanced paraphrases about grading and effort, and prohibits grade probabilities, guarantees, invented advice, and personal attacks. Strict JSON-schema responses undergo local content and copied-passage checks. These checks do not prove factual accuracy: summaries may still misinterpret evidence. Verify current syllabus requirements.

## Staying free

**Keep your Groq account on the Free plan. Do not enable paid Developer billing.** The app cannot inspect or enforce your account's billing tier; there is no request parameter that forces a paid account to be free. No alternate model, provider, paid-tier, or local-model fallback is configured.

Conservative application-wide limits:

- 25 provider attempts per UTC day, including failures.
- At least 60 seconds between attempts across all visitors.
- One provider call per attempt; 25-second timeout.
- Normally 10 minutes of cooldown after failure. HTTP 429 respects `Retry-After`, bounded to 1 minute–24 hours; authentication errors pause new provider attempts too.
- Cached views consume no generation allowance. Anonymous traffic can still exhaust the daily allowance and delay other visitors; origin checks are not authentication.

Initially populating many pages may therefore take multiple days. Limits can be revisited after checking actual token usage and account quotas. The Qwen model is currently preview; availability and free-tier limits can change. Failures show an honest delayed/unavailable state.

References: [Groq limits](https://console.groq.com/docs/rate-limits), [billing](https://console.groq.com/docs/billing-faqs), [Qwen model](https://console.groq.com/docs/model/qwen/qwen3.8-27b), [structured outputs](https://console.groq.com/docs/structured-outputs), [API reference](https://console.groq.com/docs/api-reference).

## Privacy and hosting

Selected review text now goes to **Groq**. Enable **Zero Data Retention** in the Groq account's Data Controls if desired; supplying a key does not let this app set or verify that option. Groq documents retention exceptions and ZDR availability for all customers. [Data controls](https://console.groq.com/docs/your-data).

Raw comments and internal evidence IDs are not returned by the public overview API. Names or other details inside comments may still reach Groq despite common-contact redaction. Paraphrasing/private storage does not itself grant source rights.

For Render, set `GROQ_API_KEY` as a secret on the API service, set `WEB_ORIGIN` to the frontend's exact origin, and apply migration 006 to the intended database. `render.yaml` contains only a `sync: false` placeholder, not the secret. The hosted app no longer needs your Mac for inference. Keep backups private: `npm run db:backup` includes original reviews and the new cache tables.

## Tests

```bash
npm test
npm run typecheck
npm run build
```

Normal tests use synthetic keys and mocked requests. For PostgreSQL integration tests, migrate and use only the dedicated test database:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/easy_ingestion_test npm run db:migrate
EASY_INTEGRATION_TEST=true DATABASE_URL=postgresql://postgres:postgres@localhost:5432/easy_ingestion_test npm test
```

Integration tests refuse databases whose names do not end in `_test`. The optional old local CLI is documented in [legacy instructions](AI_OVERVIEWS_LOCAL_LEGACY.md); it no longer populates the website cache.
