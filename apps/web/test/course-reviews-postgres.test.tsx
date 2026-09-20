// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getCatalogCourse } from '../lib/catalog';
import { getCourseReviews, saveStudentReview } from '../lib/student-reviews';
import { calculatePersonalScore } from '@easy-a/core';
import { repository } from '../../api/src/repository';
import { loadSource } from '../../api/src/overview/service';
import { publicOffering } from '../../api/src/public-data';

vi.mock('server-only',()=>({}));
vi.mock('../../api/src/db/client.js',()=>({pool:{query:(sql: string, values?: unknown[])=>pool.query(sql,values)}}));
const url = process.env.AUTH_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (!['localhost','127.0.0.1'].includes(parsed.hostname) || !parsed.pathname.endsWith('_test')) throw new Error('Requires an isolated localhost test database');
}
const schema = 'reviews_test_'+randomUUID().replaceAll('-','');
const pool = new Pool({connectionString:url,options:`-c search_path=${schema}`,max:3});
const admin = new Pool({connectionString:url,max:1});
const course = getCatalogCourse('NUR1140IS')!;
let created=false;
const users = Array.from({length:5},()=>randomUUID());
let offeringId: string;
const input = {professorId:'',professorName:'Catalog Verification Professor',receivedA:true,difficulty:2,tags:['online_classes','online_quizzes'] as ('online_classes'|'online_quizzes')[],comments:'Firsthand student comment.'};

describe.skipIf(!url)('catalog review persistence and professor scoring',()=>{
  beforeAll(async()=>{
    await admin.query(`CREATE SCHEMA ${schema}`);created=true;
    const directory = new URL('../../../database/migrations/',import.meta.url);
    for (const file of (await readdir(directory)).filter(name=>name.endsWith('.sql')).sort()) await pool.query(await readFile(new URL(file,directory),'utf8'));
    vi.stubGlobal('easyProfilePool',pool);
    for(const id of users) await pool.query('INSERT INTO auth_user(id,name,email) VALUES($1,$2,$3)',[id,'Private Student',id+'@example.test']);
  });
  afterAll(async()=>{
    vi.unstubAllGlobals();await pool.end();
    if(created&&/^reviews_test_[a-f0-9]{32}$/.test(schema))await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  });
  it('creates an offering for a previously unreviewed catalog course with server timestamps',async()=>{
    const before=Date.now();
    const result=await saveStudentReview(users[0]!,course,input);offeringId=result.offeringId;
    const data=await getCourseReviews(course.code);
    expect(data.summary.total).toBe(1);
    expect(data.reviews[0]?.submittedAt.getTime()).toBeGreaterThanOrEqual(before-1000);
    expect(data.reviews[0]?.tags).toEqual(['online_classes','online_quizzes']);
    expect(data.reviews[0]).not.toHaveProperty('userId');
    expect(JSON.stringify(data)).not.toContain('@example.test');
    const offering=await repository.offering(offeringId);
    expect(offering?.reviewCount).toBe(1);
    expect(offering?.score).toBeNull();
    expect((await repository.courses('1247')).some(c=>c.courseCode===course.code)).toBe(true);
  });
  it('rejects duplicates and invalid professor IDs without creating extra reviews',async()=>{
    await expect(saveStudentReview(users[0]!,course,input)).rejects.toThrow('already submitted');
    await expect(saveStudentReview(users[1]!,course,{...input,professorId:randomUUID()})).rejects.toThrow('Choose a professor');
    expect((await getCourseReviews(course.code)).summary.total).toBe(1);
  });
  it('combines student grades and tags into professor scores after five reviews',async()=>{
    for(let i=1;i<users.length;i++)await saveStudentReview(users[i]!,course,{...input,receivedA:i<3,difficulty:i+1});
    const rows=await repository.offerings(null,course.code);
    expect(rows).toHaveLength(1);
    expect(rows[0].reviewCount).toBe(5);
    expect(rows[0].studentReviewCount).toBe(5);
    expect(rows[0].gradeAPct).toBe(60);
    expect(rows[0].preferenceEvidence.online_classes).toBe(5);
    expect(rows[0].score).not.toBeNull();
    expect(calculatePersonalScore(rows[0],['online_classes']).score).toBeGreaterThan(rows[0].score);
    expect((await repository.offering(offeringId))?.score).toBe(rows[0].score);
    expect(JSON.stringify(publicOffering(rows[0]))).not.toContain('Firsthand student comment');
    expect(publicOffering(rows[0]).rmpUrl).toBeNull();
  });
  it('combines imported reviews without exposing their comments or double counting tag sources',async()=>{
    const review=(await pool.query(`INSERT INTO reviews(offering_id,rmp_review_id,grade_received,difficulty_rating,raw_comment_text)
      VALUES($1,'private-fixture','A',2,'PRIVATE_IMPORTED_COMMENT') RETURNING id`,[offeringId])).rows[0];
    await pool.query(`INSERT INTO tags(review_id,tag_type,source,confidence) VALUES
      ($1,'online_quizzes','native_rmp',1),($1,'online_quizzes','extracted_from_comment',0.72)`,[review.id]);
    const row=await repository.offering(offeringId);
    expect(row?.reviewCount).toBe(6);
    expect(row?.importedReviewCount).toBe(1);
    expect(row?.tagEvidence.online_quizzes).toBe(6);
    expect(JSON.stringify(row)).not.toContain('PRIVATE_IMPORTED_COMMENT');
    expect((await getCourseReviews(course.code)).summary.total).toBe(5);
  });
  it('supplies professor search names and private student evidence to AI overviews',async()=>{
    const courseRow=(await repository.courses('1247')).find(c=>c.courseCode===course.code);
    expect(courseRow.professorNames).toContain(input.professorName);
    const source=await loadSource(offeringId);
    expect(source?.reviews).toHaveLength(6);
    expect(source?.reviews.filter(r=>r.id.startsWith('student:'))).toHaveLength(5);
    expect(JSON.stringify(source)).not.toContain('@example.test');
    await pool.query('UPDATE student_reviews SET comments=$1 WHERE user_id=$2 AND offering_id=$3',['Changed class experience.',users[0],offeringId]);
    expect((await loadSource(offeringId))?.hash).not.toBe(source?.hash);
  });
  it('rolls back new professor and course writes if author validation fails',async()=>{
    await expect(saveStudentReview(randomUUID(),course,{...input,professorName:'Should Roll Back'})).rejects.toThrow();
    expect((await pool.query("SELECT id FROM professors WHERE name='Should Roll Back'")).rowCount).toBe(0);
  });
  it('limits repeated submissions per authenticated user',async()=>{
    for(let i=0;i<9;i++) await saveStudentReview(users[0]!,course,{...input,professorName:'Rate Test Professor '+i});
    await expect(saveStudentReview(users[0]!,course,{...input,professorName:'Too Many Reviews'})).rejects.toThrow('10 reviews');
    const data=await getCourseReviews(course.code,1);
    expect(data.reviews).toHaveLength(10);
    expect(data.pages).toBe(2);
  });
});
