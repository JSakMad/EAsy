import "server-only";
import type { StudentProfile } from "./profile-fields";
import { webDatabase as database } from './web-database';

export async function getStudentProfile(userId: string): Promise<StudentProfile | null> {
  const result = await database().query<StudentProfile>(
    'SELECT name, school_year AS "schoolYear", major, class_preferences AS preferences FROM auth_student_profile WHERE user_id = $1', [userId],
  );
  return result.rows[0] ?? null;
}

export async function saveStudentProfile(userId: string, profile: StudentProfile) {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO auth_student_profile (user_id, name, school_year, major, class_preferences) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name,
       school_year = EXCLUDED.school_year, major = EXCLUDED.major, class_preferences = EXCLUDED.class_preferences, updated_at = now()`,
      [userId, profile.name, profile.schoolYear, profile.major, profile.preferences],
    );
    await client.query('UPDATE auth_user SET name = $2, "updatedAt" = now() WHERE id = $1', [userId, profile.name]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
