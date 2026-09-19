import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import request from 'supertest';
import {pool,closeDatabase} from '../src/db/client.js';
import {saveProfessor} from '../src/ingestion/ingest-professor.js';
import {getOverview,generateOverview,loadSource} from '../src/overview/service.js';
import {createApp} from '../src/app.js';
import type {IngestedProfessor} from '../src/ingestion/types.js';
import type {Summary} from '../src/overview/policy.js';

const enabled=process.env.EASY_INTEGRATION_TEST==='true';
if(enabled&&!new URL(process.env.DATABASE_URL!).pathname.endsWith('_test'))throw new Error('Integration tests require a dedicated database ending in _test.');
describe.skipIf(!enabled)('overview database and public API (synthetic reviews, fake local model)',()=>{
  let id:string;
  const summary:Summary={summary:'Students describe manageable coursework alongside challenging tests.',easierFactors:[],harderFactors:['Exams require preparation.'],studyAdvice:[],changesOverTime:'No clear time trend is established.',evidenceIds:[1,2,3]};
  const engine={summarize:vi.fn(async()=>summary)};
  const professor:IngestedProfessor={sourceId:'fixture-overview',legacyId:80000009,name:'Overview Fixture',department:'Computer Science',overallQuality:4,overallDifficulty:2,wouldTakeAgainPct:90,
    reviews:Array.from({length:3},(_,i)=>({sourceId:`overview-review-${i}`,rawCourse:'CS1530',datePosted:i===0?null:'2020-01-01T00:00:00Z',gradeReceived:'A',difficultyRating:2,qualityRating:4,attendanceMandatory:false,rawCommentText:'PRIVATE_OVERVIEW_MARKER. Coursework is manageable. Tests are challenging.'}))};
  beforeAll(async()=>{
    await pool.query("DELETE FROM professors WHERE rmp_professor_id='fixture-overview'");
    await saveProfessor(professor);
    id=(await pool.query("SELECT o.id FROM professor_course_offerings o JOIN professors p ON p.id=o.professor_id WHERE p.rmp_professor_id='fixture-overview'")).rows[0].id;
  });
  afterAll(async()=>{await closeDatabase();});
  it('serves deterministic dates without generating AI on page requests',async()=>{
    expect(await loadSource('not-a-uuid')).toBeNull();
    expect(await getOverview(id)).toMatchObject({status:'pending',stats:{reviewCount:3,undatedCount:1,reviewsInLast24Months:0}});
    const response=await request(createApp(undefined,getOverview)).get(`/offerings/${id}/overview`);
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(engine.summarize).not.toHaveBeenCalled();
    expect(JSON.stringify(response.body)).not.toContain('PRIVATE_OVERVIEW_MARKER');
  });
  it('caches one validated summary, strips evidence IDs, and reuses unchanged evidence',async()=>{
    expect(await generateOverview(id,false,engine)).toBe('generated');
    expect(await generateOverview(id,false,engine)).toBe('cached');
    expect(engine.summarize).toHaveBeenCalledTimes(1);
    const response=await request(createApp(undefined,getOverview)).get(`/offerings/${id}/overview`);
    expect(response.body.data.status).toBe('ready');
    expect(response.body.data.overview.summary).toBe(summary.summary);
    expect(JSON.stringify(response.body)).not.toMatch(/PRIVATE_OVERVIEW_MARKER|evidenceIds|raw_comment_text/);
    expect((await request(createApp()).post(`/offerings/${id}/overview`)).status).toBe(404);
  });
  it('hides stale output after source text or date changes, then regenerates',async()=>{
    await pool.query("UPDATE reviews SET date_posted='2026-09-01',raw_comment_text=raw_comment_text||' New detail.' WHERE rmp_review_id='overview-review-0'");
    expect(await getOverview(id)).toMatchObject({status:'stale'});
    expect(await getOverview(id)).not.toHaveProperty('overview');
    expect(await generateOverview(id,false,engine)).toBe('generated');
    expect((await getOverview(id))?.stats.reviewsInLast24Months).toBe(1);
  });
  it('repairs invalid cached output instead of serving it or skipping regeneration',async()=>{
    await pool.query("UPDATE offering_ai_overviews SET summary='{}' WHERE offering_id=$1",[id]);
    expect((await getOverview(id))?.status).toBe('pending');
    expect(await generateOverview(id,false,engine)).toBe('generated');
  });
  it('discards a result if source reviews change during generation',async()=>{
    const changing={summarize:async()=>{await pool.query("UPDATE reviews SET difficulty_rating=3 WHERE rmp_review_id='overview-review-0'");return summary;}};
    await expect(generateOverview(id,true,changing)).rejects.toThrow('changed');
    expect((await getOverview(id))?.status).toBe('stale');
  });
  it('does not save malformed or unsafe model output',async()=>{
    await expect(generateOverview(id,true,{summarize:async()=>({...summary,summary:'Visit https://evil.invalid'})})).rejects.toThrow('Unsafe');
    expect((await getOverview(id))?.status).toBe('stale');
  });
  it('requires three reviews and hides previously generated content after deletions',async()=>{
    await pool.query("DELETE FROM reviews WHERE rmp_review_id='overview-review-2'");
    expect((await getOverview(id))?.status).toBe('insufficient');
    expect(await getOverview(id)).not.toHaveProperty('overview');
    expect(await generateOverview(id,false,engine)).toBe('insufficient');
  });
});
