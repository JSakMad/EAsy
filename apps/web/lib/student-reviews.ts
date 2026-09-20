import 'server-only';
import { createHash } from 'node:crypto';
import { webDatabase } from './web-database';
import type { CatalogCourse } from './catalog';
import type { ReviewInput } from './review-fields';
import type { ClassPreference } from '@easy-a/core';

export type ProfessorChoice = { id: string; name: string; department: string };
export type PublicStudentReview = { id: string; professorName: string; receivedA: boolean; difficulty: number; tags: ClassPreference[]; comments: string; submittedAt: Date };
export class ReviewWriteError extends Error {}

export async function getProfessorChoices(): Promise<ProfessorChoice[]> {
  return (await webDatabase().query<ProfessorChoice>(`SELECT p.id,p.name,p.department FROM professors p
    JOIN schools s ON s.id=p.school_id WHERE s.rmp_school_id='1247' AND NOT p.is_demo ORDER BY p.name,p.department`)).rows;
}

export async function getCourseReviews(code: string, page = 1) {
  const db = webDatabase();
  const filter = `FROM student_reviews r JOIN professor_course_offerings o ON o.id=r.offering_id
    JOIN courses c ON c.id=o.course_id JOIN schools s ON s.id=c.school_id
    JOIN professors p ON p.id=o.professor_id WHERE c.course_code=$1 AND s.rmp_school_id='1247' AND NOT p.is_demo`;
  const summary = (await db.query<{ total: number; aPercent: number | null; difficulty: number | null }>(
    `SELECT count(*)::int AS total, (100*avg(received_a::int))::float AS "aPercent", avg(difficulty)::float AS difficulty ${filter}`, [code])).rows[0]!;
  const pages = Math.max(1, Math.ceil(summary.total/10));
  const currentPage = Math.min(pages, Math.max(1, Number.isFinite(page) ? Math.trunc(page) : 1));
  const reviews = (await db.query<PublicStudentReview>(`SELECT r.id,p.name AS "professorName",r.received_a AS "receivedA",
    r.difficulty,r.tags,r.comments,r.submitted_at AS "submittedAt" ${filter}
    ORDER BY r.submitted_at DESC,r.id LIMIT 10 OFFSET $2`, [code,(currentPage-1)*10])).rows;
  return { summary, reviews, page: currentPage, pages };
}

export async function saveStudentReview(userId: string, course: CatalogCourse, input: ReviewInput) {
  const client = await webDatabase().connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", ['student-review:'+userId]);
    const recent = (await client.query("SELECT count(*)::int AS count FROM student_reviews WHERE user_id=$1 AND submitted_at > now()-interval '24 hours'", [userId])).rows[0].count;
    if (recent >= 10) throw new ReviewWriteError('You can submit up to 10 reviews in 24 hours. Please try again later.');
    const school = (await client.query("SELECT id FROM schools WHERE rmp_school_id='1247'")).rows[0];
    if (!school) throw new Error('Missing school');
    const catalogCourse = (await client.query(`INSERT INTO courses(school_id,course_code,course_title,fields_of_study,is_catalog)
      VALUES($1,$2,$3,$4,true) ON CONFLICT(school_id,course_code) DO UPDATE SET course_title=EXCLUDED.course_title,
      fields_of_study=EXCLUDED.fields_of_study,is_catalog=true RETURNING id`, [school.id,course.code,course.title,course.fieldsOfStudy])).rows[0];
    let professor: { id: string } | undefined;
    if (input.professorId) {
      professor = (await client.query('SELECT id FROM professors WHERE id=$1 AND school_id=$2 AND NOT is_demo', [input.professorId,school.id])).rows[0];
      if (!professor) throw new ReviewWriteError('Choose a professor from the list, or enter a new professor.');
    } else {
      const matching = (await client.query('SELECT id FROM professors WHERE school_id=$1 AND lower(name)=lower($2) AND NOT is_demo', [school.id,input.professorName])).rows;
      if (matching.length > 1) throw new ReviewWriteError('More than one professor has that name. Choose the matching professor from the list.');
      professor = matching[0];
      if (!professor) {
        const sourceId = 'community:' + createHash('sha256').update(school.id+':'+input.professorName.normalize('NFKC').toLowerCase()).digest('hex');
        professor = (await client.query(`INSERT INTO professors(school_id,name,department,rmp_professor_id,is_demo)
          VALUES($1,$2,$3,$4,false) ON CONFLICT(rmp_professor_id) DO UPDATE SET rmp_professor_id=EXCLUDED.rmp_professor_id RETURNING id`,
        [school.id,input.professorName,course.fieldsOfStudy[0] ?? 'Other',sourceId])).rows[0];
      }
    }
    const offering = (await client.query(`INSERT INTO professor_course_offerings(professor_id,course_id) VALUES($1,$2)
      ON CONFLICT(professor_id,course_id) DO UPDATE SET course_id=EXCLUDED.course_id RETURNING id`, [professor!.id,catalogCourse.id])).rows[0];
    const review = (await client.query(`INSERT INTO student_reviews(user_id,offering_id,received_a,difficulty,tags,comments)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,offering_id) DO NOTHING RETURNING id`,
    [userId,offering.id,input.receivedA,input.difficulty,input.tags,input.comments])).rows[0];
    if (!review) throw new ReviewWriteError('You already submitted a review for this professor and course.');
    await client.query('COMMIT');
    return { id: review.id as string, offeringId: offering.id as string };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
