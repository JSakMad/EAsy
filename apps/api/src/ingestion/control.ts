import type { PoolClient } from 'pg';
import { pool } from '../db/client.js';
import { config } from '../config.js';
import { BudgetReached, SourcePaused, type RequestGate } from './http-client.js';
// Every deployment of the scraper must use the same database and lock.
export async function withIngestionLock<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let locked = false;
  try {
    locked = (await client.query('SELECT pg_try_advisory_lock(1247,1) AS locked')).rows[0].locked;
    if (!locked) throw new SourcePaused('Another import is running. This run made no RMP requests.');
    return await run(client);
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock(1247,1)');
    client.release();
  }
}
export class PostgresRequestGate implements RequestGate {
  constructor(private client: PoolClient) {}
  async reserve() {
    const row = (await this.client.query(`SELECT *,request_day=(now() AT TIME ZONE 'UTC')::date AS same_day
      FROM ingestion_control WHERE source='rmp'`)).rows[0];
    if (!row) throw new Error('Run npm run db:migrate first.');
    if (row.blocked_reason) throw new SourcePaused(row.blocked_reason);
    if (row.same_day && row.requests_today >= config.RMP_MAX_REQUESTS_PER_DAY) throw new BudgetReached('Daily request budget reached. Resume after midnight UTC.');
    const delay = new Date(row.next_request_at).getTime() - Date.now();
    if (delay > config.RMP_REQUEST_DELAY_MS + 1000) throw new SourcePaused(`Source cooldown in effect until ${new Date(row.next_request_at).toISOString()}.`);
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
    await this.client.query(`UPDATE ingestion_control SET
      requests_today=CASE WHEN request_day=(now() AT TIME ZONE 'UTC')::date THEN requests_today+1 ELSE 1 END,
      request_day=(now() AT TIME ZONE 'UTC')::date,
      next_request_at=now()+($1 * interval '1 millisecond') WHERE source='rmp'`, [config.RMP_REQUEST_DELAY_MS]);
  }
  async pause(until: Date, reason: string | null) {
    await this.client.query(`UPDATE ingestion_control SET next_request_at=GREATEST(next_request_at,$1),
      blocked_reason=COALESCE($2,blocked_reason) WHERE source='rmp'`, [until, reason]);
  }
}
