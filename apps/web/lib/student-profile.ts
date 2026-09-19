import "server-only";
import { Pool } from "pg";
import { readAuthConfig } from "./auth-config";
import type { StudentProfile } from "./profile-fields";

const globalProfile = globalThis as typeof globalThis & { easyProfilePool?: Pool };
function database() {
  if (!globalProfile.easyProfilePool) {
    const config = readAuthConfig();
    const pool = new Pool({
      connectionString: config.databaseURL,
      ssl: config.databaseSSL ? { rejectUnauthorized: true } : undefined,
      max: 2, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000,
    });
    pool.on("error", () => console.error("Profile database connection failed"));
    globalProfile.easyProfilePool = pool;
  }
  return globalProfile.easyProfilePool;
}

export async function getStudentProfile(userId: string): Promise<StudentProfile | null> {
  const result = await database().query<StudentProfile>(
    'SELECT name, school_year AS "schoolYear", major FROM auth_student_profile WHERE user_id = $1', [userId],
  );
  return result.rows[0] ?? null;
}

export async function saveStudentProfile(userId: string, profile: StudentProfile) {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO auth_student_profile (user_id, name, school_year, major) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name,
       school_year = EXCLUDED.school_year, major = EXCLUDED.major, updated_at = now()`,
      [userId, profile.name, profile.schoolYear, profile.major],
    );
    await client.query('UPDATE auth_user SET name = $2, "updatedAt" = now() WHERE id = $1', [userId, profile.name]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
