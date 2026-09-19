import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { closeDatabase, pool } from "./client.js";

const root = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const client = await pool.connect();
try {
  await client.query("SELECT pg_advisory_lock(1247, 2)");
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())");
  const dir = resolve(root, "database/migrations");
  for (const name of (await readdir(dir)).filter(name => name.endsWith('.sql')).sort()) {
    if ((await client.query("SELECT 1 FROM schema_migrations WHERE name=$1", [name])).rowCount) continue;
    await client.query("BEGIN");
    try {
      await client.query(await readFile(resolve(dir, name), "utf8"));
      await client.query("INSERT INTO schema_migrations(name) VALUES ($1)", [name]);
      await client.query("COMMIT");
      console.log(`Applied ${name}`);
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  }
  console.log("Database migration complete.");
} finally {
  await client.query("SELECT pg_advisory_unlock(1247, 2)");
  client.release();
  await closeDatabase();
}
