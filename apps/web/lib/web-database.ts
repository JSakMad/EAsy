import 'server-only';
import { Pool } from 'pg';

const globalDatabase = globalThis as typeof globalThis & { easyProfilePool?: Pool };
export function webDatabase() {
  if (!globalDatabase.easyProfilePool) {
    const url = process.env.DATABASE_URL;
    if (!url || !['postgres:', 'postgresql:'].includes(new URL(url).protocol)) throw new Error('Database is not configured');
    const pool = new Pool({ connectionString: url,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
      max: 2, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
    pool.on('error', () => console.error('Website database connection failed'));
    globalDatabase.easyProfilePool = pool;
  }
  return globalDatabase.easyProfilePool;
}
