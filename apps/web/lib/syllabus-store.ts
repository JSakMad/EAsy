import 'server-only';
import type { ClassPreference, TagType } from '@easy-a/core';
import { SYLLABUS_CHECKER_VERSION } from './syllabus-ai';
import { webDatabase } from './web-database';
import { SyllabusError, type SyllabusResult } from './syllabus-check';

export async function syllabusReview(userId: string, offeringId: string) {
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(offeringId)) throw new SyllabusError('Syllabus uploads are only available for real professor/course pages.');
  const result = await webDatabase().query<{ reviewId: string; courseCode: string; courseTitle: string | null; professorName: string; tags: ClassPreference[] }>(
    `SELECT r.id AS "reviewId", c.course_code AS "courseCode", c.course_title AS "courseTitle", p.name AS "professorName", r.tags
     FROM student_reviews r JOIN professor_course_offerings o ON o.id=r.offering_id
     JOIN professors p ON p.id=o.professor_id JOIN courses c ON c.id=o.course_id JOIN schools s ON s.id=c.school_id
     WHERE r.user_id=$1 AND r.offering_id=$2 AND NOT p.is_demo AND s.rmp_school_id='1247'`, [userId, offeringId]);
  if (!result.rows[0]) throw new SyllabusError('Leave a review for this professor and course first, then upload the syllabus to check your reported tags.');
  return result.rows[0];
}

export async function reserveSyllabusAttempt(userId: string) {
  const client = await webDatabase().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', ['syllabus:'+userId]);
    const { rows } = await client.query("SELECT count(*)::int AS count FROM syllabus_upload_attempts WHERE user_id=$1 AND attempted_at>now()-interval '24 hours'", [userId]);
    if (rows[0].count >= 10) throw new SyllabusError('You can check up to 10 syllabuses per day. Please try again tomorrow.');
    await client.query('INSERT INTO syllabus_upload_attempts(user_id) VALUES($1)', [userId]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function saveSyllabusCheck(reviewId: string, hash: string, result: SyllabusResult) {
  await webDatabase().query(`INSERT INTO syllabus_verifications(review_id,document_hash,preferences,tags,checker_version)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT(review_id) DO UPDATE SET document_hash=EXCLUDED.document_hash,
    preferences=EXCLUDED.preferences,tags=EXCLUDED.tags,checked_at=now(),checker_version=EXCLUDED.checker_version`, [reviewId, hash, result.preferences, result.tags, SYLLABUS_CHECKER_VERSION]);
}

export type SyllabusSupport = { tags: TagType[]; preferences: ClassPreference[]; checkedAt: string | null; available: boolean };
export async function getSyllabusSupport(offeringId: string): Promise<SyllabusSupport> {
  const empty: SyllabusSupport = { tags: [], preferences: [], checkedAt: null, available: true };
  if (offeringId.startsWith('demo-')) return empty;
  try {
    const { rows } = await webDatabase().query<{ tags: TagType[]; preferences: ClassPreference[]; checkedAt: Date }>(
      `SELECT v.tags,v.preferences,v.checked_at AS "checkedAt" FROM syllabus_verifications v
       JOIN student_reviews r ON r.id=v.review_id WHERE r.offering_id=$1 AND v.checker_version=$2
       AND cardinality(v.preferences)>0 AND v.preferences <@ r.tags AND v.checked_at>now()-interval '180 days' ORDER BY v.checked_at DESC`, [offeringId, SYLLABUS_CHECKER_VERSION]);
    return { tags: [...new Set(rows.flatMap(row=>row.tags))], preferences: [...new Set(rows.flatMap(row=>row.preferences))], checkedAt: rows[0]?.checkedAt.toISOString() ?? null, available: true };
  } catch { return { ...empty, available: false }; }
}
