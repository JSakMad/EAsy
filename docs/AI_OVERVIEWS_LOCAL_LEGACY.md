# EAsy: free, local AI overviews

> Historical setup only. The website now uses on-demand Groq summaries. See [current instructions](AI_OVERVIEWS.md). Local CLI generation remains optional and writes to the separate legacy cache; it no longer populates the website overview card.

## What changed

Each professor/course detail page now includes an AI overview card. It summarizes the stored reviews for **that exact pairing**, focusing on grading, workload, exams, study resources, and the effort associated with earning an A. It does not mix the instructor's other courses, alter the existing EAsy score, or invent a probability of earning an A.

The card shows the oldest/newest valid review posting dates, review count, and how many were posted in the last 24 months. A separate warning appears when none are recent. Unknown and future dates are excluded from those date statistics. The AI generation date is explicitly different from the evidence's age.

At least three reviews are required for a summary; the existing score still requires five. Missing, insufficient, outdated, or rejected summaries get an honest placeholder, not fabricated content. Demo reviews are excluded.

## Why this costs no AI API money

This implementation runs **Ollama + `qwen3.5:9b` on your Mac**. Both were already installed during setup; no model download, account, API key, credit card, or paid fallback was added. Local processing still uses electricity, memory, and computation time.

Research checked September 16, 2026:

| Option | Cost/privacy tradeoff | Decision |
| --- | --- | --- |
| Local Ollama | No per-request AI API billing; local prompts stay local; cloud can be disabled. Requires local hardware. | Implemented. |
| Groq Free Plan | Free requests subject to model-specific quotas; reviews would go to a hosted provider. | Not connected. |
| Gemini API free tier | Limited free usage on supported models; pricing documentation marks free-tier content as used to improve products. | Not connected. |

Sources: [Ollama FAQ](https://docs.ollama.com/faq), [Groq rate limits](https://console.groq.com/docs/rate-limits), [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing). Provider offerings can change; this app does not depend on a hosted free tier remaining free.

## Running it on your Mac

Your normal arrangement stays the same: PostgreSQL in Docker, Node services and Ollama on macOS. Ollama runs natively to use your Mac GPU; the Ollama FAQ notes that Docker Desktop on macOS lacks GPU passthrough.

In a VS Code terminal:

```bash
cd "/Users/joshua/Library/CloudStorage/OneDrive-Personal/Projects/EAsy"
docker compose up -d
npm run db:migrate
npm run ai:serve
```

Leave that terminal running during generation. `ai:serve` sets `OLLAMA_NO_CLOUD=1`, binds to `127.0.0.1:11435`, and allows only one parallel model request. Port 11435 is separate from the normal Ollama app. If that port is already in use by the EAsy model server started during setup, reuse it rather than starting a second copy. Check its startup log for `Ollama cloud disabled: true`.

In another terminal, from the same project folder:

```bash
# Show cached-summary status and offering IDs:
npm run overview:status

# Prepare up to five missing/outdated summaries, starting with larger review sets:
npm run overview:generate -- --limit 5

# Or prepare a specific professor/course using the UUID at the end of its page URL:
npm run overview:generate -- --offering YOUR_OFFERING_UUID

# Show the website, if it is not already running:
npm run dev
```

Open http://localhost:3000, search for a course, and select its professor. Refresh after generation finishes. Do not start `npm run dev` on top of an existing server using ports 3000/4000; stop the older server in its terminal first.

After new imports or corrected course assignments, run the generation command again. Unchanged valid summaries are skipped; changed evidence hides the old summary immediately. `--force` regenerates even unchanged evidence. The limit is 1–100 offerings per run; `--limit 100` handles up to 100 eligible pairings but can take a long time. Default is five. Two concurrent jobs are prevented by a database lock.

You may stop Ollama after generation: saved summaries remain available when browsing. Page requests do not call the model. Generation is an operator-only CLI, not a public API endpoint or a visitor-triggered button. Your Mac must remain awake while generation runs. Stopping a job leaves completed summaries saved; an unfinished pairing is not partially published.

The implementation expects the local model name `qwen3.5:9b`. On a different computer, install Ollama and that local model first. Do not substitute a cloud-tagged model. The client checks for local model files and rejects a remote-backed model before sending review text. The endpoint is fixed to loopback and HTTP redirects are rejected.

## Prompt design and safeguards

The exact prompt and validation rules are in `apps/api/src/overview/policy.ts`.

- Separate trusted instructions from JSON-wrapped, untrusted review data. A review cannot legitimately issue instructions to the summarizer. No browsing, tools, or external actions are supplied.
- Request balanced evidence about ease, effort, contradictory experiences, and supported preparation—not an artificially positive “easy A” conclusion. Treat reviews as self-selected anecdotes, not verified policy.
- Ask for paraphrases, not quotations. Exclude personal names, contact details, personal attacks, and unrelated content. Redact common URLs, emails, and phone numbers before inference.
- Send posting dates with each review, but compute date ranges and recency counts in application code. Do not ask the model to calculate numerical confidence, grade probabilities, or date statistics.
- Process every stored review in batches, splitting long comments without silently truncating them. Combine batch summaries hierarchically while warning that fragments may share the same review ID. Very large sets over 100 batches fail explicitly rather than publishing a sampled summary. Hierarchical summarization can still lose nuance; “processed every review” does not mean every detail survives the final summary.
- Require structured JSON and actual evidence IDs, validate types/lengths and allowed IDs, reject URLs/contact details/HTML/numerical percentages/explicit guarantees and copied 12-word passages. One bounded rewrite is allowed after invalid output; further failure publishes nothing. These checks reduce risk, but do not prove each claim is grounded or eliminate prompt injection and hallucination.
- The prompt requests under 250 words; the validator caps prose at 300 words. Temperature is zero. Model output remains probabilistic and should be checked against the current syllabus.

Design references: [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs), [Ollama chat API](https://docs.ollama.com/api/chat), and [OWASP prompt-injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html).

## Storage, privacy, and deployment

Migration `005_ai_overviews.sql` adds `offering_ai_overviews`, keyed by offering ID, with summary JSON, source fingerprint, model/prompt version, and generation timestamp. Existing raw reviews stay in their original private table. No new raw-review copy is saved by this feature. The cache has row-level security enabled and no public/anonymous table access. The public read endpoint `/offerings/:id/overview` returns approved summary fields and date statistics, not comments or private evidence IDs.

The fingerprint includes review text, dates, grades, difficulty, identities, course/professor scope, prompt, schema, and model name. Review changes, moves, and deletions invalidate the cache. Evidence is checked again before saving. Bump the prompt version and regenerate if replacing model weights under the same model name. The timestamp and fingerprint identify provenance, not factual correctness.

`npm run db:backup` includes the new table in the existing local Compose backup. Backups also contain private original reviews: keep them out of Git, public downloads, and shared folders. This project is inside OneDrive, so local files/backups may sync under your OneDrive settings; “local AI” is not a promise that your storage provider never receives those files. Keeping comments private or paraphrasing them does not itself resolve source terms or ownership restrictions.

For future hosting, deploy migration 005 and the updated app/API against the same database. Generate summaries on your Mac with its `DATABASE_URL` pointing to that intended database, using the appropriate database credentials and TLS configuration. Cloud servers serve only the saved results; they do not need Ollama. Do not expose port 11435 or assume Render can reach your Mac's localhost. Existing hosting/database charges are separate from the zero AI API cost.

## Troubleshooting

- **Overview not generated yet:** run generation for that offering. The website intentionally does not trigger it.
- **More reviews needed:** fewer than three reviews exist for this specific professor/course.
- **New evidence—overview needs refreshing:** run generation after your import or course corrections.
- **Local model unavailable:** start `npm run ai:serve`; check the model exists with `OLLAMA_HOST=127.0.0.1:11435 ollama list`. Close other memory-intensive local model workloads if needed.
- **Output failed checks / incomplete response:** no new overview was published. Try that offering again. Repeated failure needs inspection of the prompt/model; do not weaken the privacy checks just to publish an answer. Logs deliberately omit raw comments and model responses.
- **Another generation job is running:** wait for it to finish. Do not launch overlapping generators.
- **Large course takes minutes:** each review batch and combination step needs a model call. Saved summaries then load without further inference.

No changes were made to scraper requests, rate limits, source review text, course normalization, or existing ranking formulas.
