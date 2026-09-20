import { readFile } from 'node:fs/promises';
import dotenv from 'dotenv';
import pg from 'pg';
const root = new URL('../', import.meta.url);
dotenv.config({ path: new URL('.env', root), quiet: true });
const { courses } = JSON.parse(await readFile(new URL('config/course-catalog.json', root), 'utf8'));
const client = new pg.Client({ connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined });
try {
  await client.connect(); await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(1247, 10)');
  const { rows: [school] } = await client.query("SELECT id FROM schools WHERE rmp_school_id='1247'");
  if (!school) throw new Error('Run database migrations before importing the catalog.');
  for (let i=0; i<courses.length; i+=200) {
    await client.query(`INSERT INTO courses(school_id, course_code, course_title, fields_of_study, is_catalog)
      SELECT $1, code, title, "fieldsOfStudy", true FROM jsonb_to_recordset($2::jsonb)
      AS course(code text, title text, "fieldsOfStudy" text[])
      ON CONFLICT(school_id,course_code) DO UPDATE SET course_title=EXCLUDED.course_title,
      fields_of_study=EXCLUDED.fields_of_study, is_catalog=true`, [school.id, JSON.stringify(courses.slice(i,i+200))]);
  }
  await client.query('COMMIT'); console.log(`Imported ${courses.length} catalog courses without replacing reviews or offerings.`);
} catch {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Catalog import failed. Check the database connection and run migrations first.'); process.exitCode=1;
} finally { await client.end(); }
