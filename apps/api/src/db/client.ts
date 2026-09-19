import pg from "pg";
import { config } from "../config.js";

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  ssl: config.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
  max: 8,
});

export async function closeDatabase() { await pool.end(); }
