import {beforeEach,afterAll,describe,it,expect,vi} from 'vitest';
import request from 'supertest';
import {pool,closeDatabase} from '../src/db/client.js';
import {saveProfessor} from '../src/ingestion/ingest-professor.js';
import {getCloudOverview,ensureCloudOverview,DAILY_REQUEST_LIMIT} from '../src/overview/cloud-service.js';
import {GroqFailure,CACHE_MS} from '../src/overview/groq.js';
import {createApp} from '../src/app.js';
import type {Summary} from '../src/overview/policy.js';
import type {IngestedProfessor} from '../src/ingestion/types.js';
const enabled=process.env.EASY_INTEGRATION_TEST==='true';
if(enabled&&!new URL(process.env.DATABASE_URL!).pathname.endsWith('_test'))throw new Error('Dedicated test database required');
describe.skipIf(!enabled)('monthly cloud overview cache (no real provider calls)',()=>{
  let id:string;
  const summary:Summary={summary:'Students describe a manageable workload alongside challenging tests.',easierFactors:[],harderFactors:[],studyAdvice:[],changesOverTime:'No clear time trend is established.',evidenceIds:[1,2,3]};
  const engine={available:true,summarize:vi.fn(async()=>summary)};
  const professor:IngestedProfessor={sourceId:'fixture-cloud-overview',legacyId:80000019,name:'Cloud Fixture',department:'Computer Science',overallQuality:4,overallDifficulty:2,wouldTakeAgainPct:90,
    reviews:Array.from({length:6},(_,i)=>({sourceId:`cloud-fixture-${i}`,rawCourse:'CS1530',datePosted:i===0?null:'2025-01-01T00:00:00Z',gradeReceived:'A',difficultyRating:2,qualityRating:4,attendanceMandatory:false,rawCommentText:'PRIVATE_CLOUD_MARKER. Readings are manageable; tests require study.'}))};
  beforeEach(async()=>{
    engine.summarize.mockClear();
    await pool.query("DELETE FROM professors WHERE rmp_professor_id='fixture-cloud-overview'");
    await saveProfessor(professor);
    id=(await pool.query("SELECT o.id FROM professor_course_offerings o JOIN professors p ON p.id=o.professor_id WHERE p.rmp_professor_id='fixture-cloud-overview'")).rows[0].id;
    await pool.query("UPDATE overview_api_budget SET attempts=0,request_day=(now() AT TIME ZONE 'UTC')::date,next_request_at=now() WHERE id=1");
  });
  afterAll(closeDatabase);
  it('never generates on GET, and serves a cached response on repeated POSTs',async()=>{
    const app=createApp(undefined,getCloudOverview,id=>ensureCloudOverview(id,engine));
    expect((await request(app).get(`/offerings/${id}/overview`)).body.data.status).toBe('pending');
    expect(engine.summarize).not.toHaveBeenCalled();
    for(let i=0;i<2;i++) {
      const response=await request(app).post(`/offerings/${id}/overview/generate`).set('Origin','http://localhost:3000').send({});
      expect(response.status).toBe(200);expect(response.body.data.status).toBe('ready');
      expect(JSON.stringify(response.body)).not.toMatch(/PRIVATE_CLOUD_MARKER|evidenceIds|cloud-fixture/);
    }
    expect(engine.summarize).toHaveBeenCalledTimes(1);
    expect((await pool.query('SELECT attempts FROM overview_api_budget WHERE id=1')).rows[0].attempts).toBe(1);
  });
  it('reuses cached evidence for 30 days even when new reviews arrive',async()=>{
    await ensureCloudOverview(id,engine);
    await saveProfessor({...professor,reviews:[{...professor.reviews[0]!,sourceId:'cloud-new-review',datePosted:'2026-09-01T00:00:00Z'}]});
    const result=await ensureCloudOverview(id,engine);
    expect(result).toMatchObject({status:'ready',totalReviews:7,sourceChanged:true,stats:{reviewCount:6}});
    expect(engine.summarize).toHaveBeenCalledTimes(1);
    // Date range remains that of the saved sample, not the newly imported date.
    expect(result!.stats.newestReviewAt).toBe('2025-01-01T00:00:00.000Z');
  });
  it('serves complete cached sentences without rewriting the database or making another model call',async()=>{
    await ensureCloudOverview(id,engine);
    const broken={...summary,summary:summary.summary+' The textbook was less '};
    await pool.query('UPDATE offering_cloud_overviews SET summary=$2 WHERE offering_id=$1',[id,JSON.stringify(broken)]);
    const result=await ensureCloudOverview(id,engine);
    expect(result).toMatchObject({status:'ready',overview:{summary:summary.summary}});
    expect(engine.summarize).toHaveBeenCalledTimes(1);
    expect((await pool.query('SELECT summary FROM offering_cloud_overviews WHERE offering_id=$1',[id])).rows[0].summary.summary).toBe(broken.summary);
  });
  it('does not save an incomplete paragraph returned by a model engine',async()=>{
    const incomplete={available:true,summarize:async()=>({...summary,summary:summary.summary+' The textbook was less '})};
    expect(await ensureCloudOverview(id,incomplete)).toMatchObject({status:'pending',reason:'validation'});
    expect(await getCloudOverview(id)).not.toHaveProperty('overview');
  });
  it('expires exactly at 30 days and regenerates on the next visit',async()=>{
    const first=await ensureCloudOverview(id,engine);
    expect((await getCloudOverview(id,new Date(Date.parse(first!.generatedAt!)+CACHE_MS-1)))?.status).toBe('ready');
    expect((await getCloudOverview(id,new Date(Date.parse(first!.generatedAt!)+CACHE_MS)))?.status).toBe('stale');
    await pool.query("UPDATE offering_cloud_overviews SET generated_at=now()-interval '31 days' WHERE offering_id=$1",[id]);
    await pool.query('UPDATE overview_api_budget SET next_request_at=now() WHERE id=1');
    expect((await ensureCloudOverview(id,engine))?.status).toBe('ready');
    expect(engine.summarize).toHaveBeenCalledTimes(2);
  });
  it('deduplicates concurrent generation across database connections',async()=>{
    let release!:()=>void;let entered!:()=>void;
    const waiting=new Promise<void>(resolve=>{release=resolve;});
    const started=new Promise<void>(resolve=>{entered=resolve;});
    const slow={available:true,summarize:vi.fn(async()=>{entered();await waiting;return summary;})};
    const first=ensureCloudOverview(id,slow);await started;
    try {expect((await ensureCloudOverview(id,slow))?.reason).toBe('busy');}
    finally {release();await first;}
    expect(slow.summarize).toHaveBeenCalledTimes(1);
  });
  it('retains a clearly stale summary on quota failure and persists cooldown without retrying',async()=>{
    await ensureCloudOverview(id,engine);
    await pool.query("UPDATE offering_cloud_overviews SET generated_at=now()-interval '31 days' WHERE offering_id=$1",[id]);
    await pool.query('UPDATE overview_api_budget SET next_request_at=now() WHERE id=1');
    const quota={available:true,summarize:vi.fn(async()=>{throw new GroqFailure('quota',120);})};
    const result=await ensureCloudOverview(id,quota);
    expect(result).toMatchObject({status:'stale',reason:'quota',overview:{summary:summary.summary}});
    expect(result!.retryAfter).toBeGreaterThan(0);
    await ensureCloudOverview(id,quota);expect(quota.summarize).toHaveBeenCalledTimes(1);
  });
  it('blocks daily-budget exhaustion without making a provider call',async()=>{
    await pool.query('UPDATE overview_api_budget SET attempts=$1 WHERE id=1',[DAILY_REQUEST_LIMIT]);
    expect((await ensureCloudOverview(id,engine))?.reason).toBe('daily_limit');
    expect(engine.summarize).not.toHaveBeenCalled();
    await pool.query("UPDATE overview_api_budget SET request_day=(now() AT TIME ZONE 'UTC')::date-1 WHERE id=1");
    expect((await ensureCloudOverview(id,engine))?.status).toBe('ready');
  });
  it('blocks minute-budget exhaustion and an absent key without provider calls',async()=>{
    expect((await ensureCloudOverview(id,{...engine,available:false}))?.reason).toBe('unconfigured');
    await pool.query("UPDATE overview_api_budget SET next_request_at=now()+interval '1 minute' WHERE id=1");
    expect((await ensureCloudOverview(id,engine))?.reason).toBe('cooldown');
    expect(engine.summarize).not.toHaveBeenCalled();
  });
  it('does not accept client-supplied evidence, cross-origin generation, or invalid IDs',async()=>{
    const app=createApp(undefined,getCloudOverview,id=>ensureCloudOverview(id,engine));
    expect((await request(app).post(`/offerings/${id}/overview/generate`).send({reviews:['injected']})).status).toBe(400);
    expect((await request(app).post(`/offerings/${id}/overview/generate`).set('Origin','https://evil.invalid').send({})).status).toBe(403);
    expect((await request(app).post('/offerings/invalid/overview/generate').send({})).status).toBe(404);
    expect(engine.summarize).not.toHaveBeenCalled();
  });
  it('does not publish invalid output or results generated while evidence changed',async()=>{
    const changing={available:true,summarize:async()=>{await pool.query("UPDATE reviews SET difficulty_rating=4 WHERE rmp_review_id='cloud-fixture-0'");return summary;}};
    const result=await ensureCloudOverview(id,changing);
    expect(result).toMatchObject({status:'pending',reason:'validation'});
    expect(result).not.toHaveProperty('overview');
  });
  it('hides summaries whose sampled reviews were deleted',async()=>{
    await ensureCloudOverview(id,engine);
    await pool.query("DELETE FROM reviews WHERE rmp_review_id='cloud-fixture-0'");
    expect(await getCloudOverview(id)).not.toHaveProperty('overview');
  });
});
