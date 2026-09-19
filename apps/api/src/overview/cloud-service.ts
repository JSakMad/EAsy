import {pool} from '../db/client.js';
import {loadSource} from './service.js';
import {freshness,publicSummary,type Review} from './policy.js';
import {validateCloudSummary} from './output-quality.js';
import {CACHE_MS,CLOUD_VERSION,GROQ_MODEL,GroqFailure,GroqSummarizer,selectSample,type CloudEngine} from './groq.js';

export const DAILY_REQUEST_LIMIT=25;
type Stats=ReturnType<typeof freshness>;
export interface CloudOverview {
  status:'ready'|'stale'|'pending'|'insufficient'|'unavailable';
  stats:Stats;totalReviews:number;provider:'Groq';minimumReviews:number;
  generatedAt?:string;model?:string;overview?:ReturnType<typeof publicSummary>;
  retryAfter?:number;reason?:string;sourceChanged?:boolean;truncatedCount?:number;
}
interface SampleMetadata {ids:string[];dates:(string|null)[];truncatedCount:number}
const snapshotReviews=(meta:SampleMetadata):Review[]=>meta.ids.map((id,i)=>({id,date:meta.dates[i]??null,text:'',grade:null,difficulty:0}));
export async function getCloudOverview(id:string,now=new Date()):Promise<CloudOverview|null> {
  const source=await loadSource(id);if(!source)return null;
  const base={stats:freshness(source.reviews,now),totalReviews:source.reviews.length,provider:'Groq' as const,minimumReviews:3};
  if(source.reviews.length<3)return {...base,status:'insufficient'};
  const row=(await pool.query('SELECT * FROM offering_cloud_overviews WHERE offering_id=$1',[id])).rows[0];
  const retryAfter=row?Math.max(0,Math.ceil((row.next_attempt_at.getTime()-now.getTime())/1000)):0;
  if(row?.summary&&row.prompt_version===CLOUD_VERSION&&row.model===GROQ_MODEL) {
    try {
      const meta=row.sample_metadata as SampleMetadata;
      // Never keep showing a summary built from a review that was deleted/moved.
      if(!meta.ids.every(id=>source.reviews.some(r=>r.id===id)))throw new Error('Removed evidence');
      const summary=validateCloudSummary(row.summary,source.reviews,meta.ids.map((_,i)=>i+1),true);
      const age=now.getTime()-row.generated_at.getTime();
      return {...base,stats:freshness(snapshotReviews(meta),now),status:age>=0&&age<CACHE_MS?'ready':'stale',
        overview:publicSummary(summary),generatedAt:row.generated_at.toISOString(),model:row.model,
        sourceChanged:row.source_hash!==source.hash,truncatedCount:meta.truncatedCount,retryAfter,reason:row.last_error_code??undefined};
    } catch {/* Invalid or removed evidence is never rendered. */}
  }
  return {...base,status:'pending',retryAfter,reason:row?.last_error_code??undefined};
}

export async function ensureCloudOverview(id:string,engine:CloudEngine=new GroqSummarizer()):Promise<CloudOverview|null> {
  const initial=await getCloudOverview(id);
  if(!initial||initial.status==='ready'||initial.status==='insufficient')return initial;
  if(!engine.available)return {...initial,status:initial.overview?'stale':'unavailable',reason:'unconfigured'};
  const client=await pool.connect();let locked=false;
  try {
    // One cross-process job at a time, plus persisted global/minute/day budgets.
    locked=(await client.query('SELECT pg_try_advisory_lock(1247,4) AS locked')).rows[0].locked;
    if(!locked)return {...initial,retryAfter:3,reason:'busy'};
    const current=await getCloudOverview(id);
    if(!current||current.status==='ready'||current.status==='insufficient')return current;
    if(current.retryAfter)return current;
    const source=await loadSource(id);if(!source)return null;
    const sample=selectSample(source.reviews);
    if(sample.reviews.length<3)return {...current,status:'insufficient',reason:'sample_too_small'};
    const budget=(await client.query(`UPDATE overview_api_budget SET
      attempts=CASE WHEN request_day=(now() AT TIME ZONE 'UTC')::date THEN attempts+1 ELSE 1 END,
      request_day=(now() AT TIME ZONE 'UTC')::date,next_request_at=now()+interval '60 seconds'
      WHERE id=1 AND next_request_at<=now() AND (request_day<>(now() AT TIME ZONE 'UTC')::date OR attempts<$1) RETURNING id`,[DAILY_REQUEST_LIMIT])).rowCount;
    if(!budget) {
      const gate=(await client.query("SELECT *,request_day=(now() AT TIME ZONE 'UTC')::date AS today FROM overview_api_budget WHERE id=1")).rows[0];
      const daily=Number(gate.attempts)>=DAILY_REQUEST_LIMIT&&gate.today;
      return {...current,retryAfter:daily?3600:Math.max(1,Math.ceil((gate.next_request_at.getTime()-Date.now())/1000)),reason:daily?'daily_limit':'cooldown'};
    }
    await client.query(`INSERT INTO offering_cloud_overviews(offering_id,next_attempt_at) VALUES($1,now()+interval '10 minutes')
      ON CONFLICT(offering_id) DO UPDATE SET next_attempt_at=EXCLUDED.next_attempt_at`,[id]);
    try {
      const summary=validateCloudSummary(await engine.summarize(sample.reviews),source.reviews,sample.reviews.map((_,i)=>i+1));
      if((await loadSource(id))?.hash!==source.hash)throw new GroqFailure('validation');
      const metadata:SampleMetadata={ids:sample.reviews.map(r=>r.id),dates:sample.reviews.map(r=>r.date),truncatedCount:sample.truncatedCount};
      await client.query(`UPDATE offering_cloud_overviews SET summary=$2,source_hash=$3,sample_metadata=$4,
        model=$5,prompt_version=$6,generated_at=now(),next_attempt_at=now(),last_error_code=NULL WHERE offering_id=$1`,
        [id,JSON.stringify(summary),source.hash,JSON.stringify(metadata),GROQ_MODEL,CLOUD_VERSION]);
    } catch(error) {
      const safe=error instanceof GroqFailure?error:new GroqFailure('validation');
      await client.query(`UPDATE offering_cloud_overviews SET last_error_code=$2,next_attempt_at=now()+make_interval(secs=>$3) WHERE offering_id=$1`,[id,safe.code,safe.retrySeconds]);
      if(safe.code==='quota'||safe.code==='authentication')await client.query(`UPDATE overview_api_budget SET next_request_at=greatest(next_request_at,now()+make_interval(secs=>$1)) WHERE id=1`,[safe.retrySeconds]);
    }
    return await getCloudOverview(id);
  } finally {if(locked)await client.query('SELECT pg_advisory_unlock(1247,4)');client.release();}
}
