export class BudgetReached extends Error {}
export class SourcePaused extends Error {}
export interface RequestGate {
  reserve(): Promise<void>;
  pause(until: Date, reason: string | null): Promise<void>;
}
export function retryAfterDate(value: string | null, now: number): Date {
  const minimum = now + 24 * 60 * 60 * 1000;
  if (!value) return new Date(minimum);
  const parsed = /^\d+$/.test(value) ? now + Number(value) * 1000 : Date.parse(value);
  return new Date(Number.isFinite(parsed) ? Math.max(minimum, parsed) : minimum);
}
export class RmpHttpClient {
  requests = 0;
  constructor(private gate: RequestGate, private maxRequests: number, private fetcher: typeof fetch = fetch) {}
  async request<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    if (this.requests >= this.maxRequests) throw new BudgetReached('Per-run request budget reached. Progress was saved; resume in a later run.');
    await this.gate.reserve();
    this.requests++;
    let response: Response;
    try {
      response = await this.fetcher('https://www.ratemyprofessors.com/graphql', {
        method: 'POST', redirect: 'manual',
        headers: {
          // Public frontend credential, not an account/session credential.
          Authorization: 'Basic dGVzdDp0ZXN0', 'Content-Type': 'application/json',
          'User-Agent': 'EAsy/1.0 (personal Pitt course research; sequential requests)',
        },
        body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(30_000),
      });
    } catch {
      await this.gate.pause(new Date(Date.now() + 60 * 60 * 1000), null);
      throw new SourcePaused('Network request failed; stopped with a one-hour cooldown. No automatic retry.');
    }
    if (response.status === 429) {
      const until = retryAfterDate(response.headers.get('retry-after'), Date.now());
      await this.gate.pause(until, null);
      throw new SourcePaused(`RMP returned 429; stopped until at least ${until.toISOString()}. No retry was made.`);
    }
    if ([401, 403].includes(response.status) || (response.status >= 300 && response.status < 400)) {
      const reason = `RMP denied or redirected access (HTTP ${response.status}). Ingestion is blocked pending source-access review.`;
      await this.gate.pause(new Date(), reason);
      throw new SourcePaused(reason);
    }
    if (!response.ok) {
      await this.gate.pause(new Date(Date.now() + 60 * 60 * 1000), null);
      throw new SourcePaused(`RMP returned HTTP ${response.status}; stopped with a one-hour cooldown.`);
    }
    if (!response.headers.get('content-type')?.includes('application/json')) {
      const reason = 'Expected JSON but received a possible access challenge. Ingestion blocked; no bypass attempted.';
      await this.gate.pause(new Date(), reason);
      throw new SourcePaused(reason);
    }
    const payload = await response.json() as { data?: T; errors?: unknown[] };
    if (!payload.data || payload.errors?.length) {
      await this.gate.pause(new Date(Date.now() + 60 * 60 * 1000), null);
      throw new SourcePaused('GraphQL returned an error or incomplete data. Check the source schema before restarting.');
    }
    return payload.data;
  }
}
