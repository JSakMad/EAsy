import {pool} from '../db/client.js';
import {isCanonicalCourseCode} from '@easy-a/core';
import {fingerprint,freshness,publicSummary,validateSummary,MODEL,PROMPT_VERSION,type Review,type Summary} from './policy.js';
import {LocalSummarizer} from './ollama.js';

export async function loadSource(id:string) {
  if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id))return null;
  const info=(await pool.query(`SELECT c.course_code,p.name FROM professor_course_offerings o JOIN courses c ON c.id=o.course_id
    JOIN professors p ON p.id=o.professor_id WHERE o.id=$1 AND NOT p.is_demo`,[id])).rows[0];
  if(!info||!isCanonicalCourseCode(info.course_code))return null;
  const rows=await pool.query(`SELECT rmp_review_id,raw_comment_text,date_posted,grade_received,difficulty_rating FROM reviews WHERE offering_id=$1 ORDER BY rmp_review_id`,[id]);
  if(!rows.rowCount)return null;
  const reviews:Review[]=rows.rows.map(r=>({id:r.rmp_review_id,text:r.raw_comment_text,date:r.date_posted?.toISOString()??null,grade:r.grade_received,difficulty:Number(r.difficulty_rating)}));
  return {reviews,hash:fingerprint(info.course_code,info.name,reviews),course:info.course_code};
}
export async function getOverview(id:string) {
  const source=await loadSource(id);
  if(!source)return null;
  const stats=freshness(source.reviews);
  const base={stats,scope:'professor_course',minimumReviews:3};
  if(source.reviews.length<3)return {...base,status:'insufficient' as const};
  const cached=(await pool.query('SELECT source_hash,summary,generated_at,model,prompt_version FROM offering_ai_overviews WHERE offering_id=$1',[id])).rows[0];
  if(!cached)return {...base,status:'pending' as const};
  // Do not serve obsolete summaries after a review changes, is moved, or is removed.
  if(cached.source_hash!==source.hash||cached.prompt_version!==PROMPT_VERSION)return {...base,status:'stale' as const};
  try {
    const summary=validateSummary(cached.summary,source.reviews,source.reviews.map((_,i)=>i+1));
    return {...base,status:'ready' as const,overview:publicSummary(summary),generatedAt:cached.generated_at.toISOString(),model:cached.model};
  } catch {return {...base,status:'pending' as const};}
}
export async function generateOverview(id:string,force=false,engine:{summarize(reviews:Review[]):Promise<Summary>}=new LocalSummarizer()) {
  const client=await pool.connect();let locked=false;
  try {
    locked=(await client.query('SELECT pg_try_advisory_lock(1247,3) AS locked')).rows[0].locked;
    if(!locked)throw new Error('Another overview generation job is running');
    const source=await loadSource(id);
    if(!source||source.reviews.length<3)return 'insufficient';
    const cached=(await client.query('SELECT source_hash,prompt_version,summary FROM offering_ai_overviews WHERE offering_id=$1',[id])).rows[0];
    if(!force&&cached?.source_hash===source.hash&&cached.prompt_version===PROMPT_VERSION) {
      try {validateSummary(cached.summary,source.reviews,source.reviews.map((_,i)=>i+1));return 'cached';}
      catch {/* Invalid cached output is regenerated, never served. */}
    }
    const summary=validateSummary(await engine.summarize(source.reviews),source.reviews,source.reviews.map((_,i)=>i+1));
    const current=await loadSource(id);
    if(current?.hash!==source.hash)throw new Error('Reviews changed during generation; result discarded');
    await client.query(`INSERT INTO offering_ai_overviews(offering_id,source_hash,prompt_version,model,summary) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(offering_id) DO UPDATE SET source_hash=EXCLUDED.source_hash,prompt_version=EXCLUDED.prompt_version,
      model=EXCLUDED.model,summary=EXCLUDED.summary,generated_at=now()`,[id,source.hash,PROMPT_VERSION,MODEL,JSON.stringify(summary)]);
    return 'generated';
  } finally {if(locked)await client.query('SELECT pg_advisory_unlock(1247,3)');client.release();}
}
