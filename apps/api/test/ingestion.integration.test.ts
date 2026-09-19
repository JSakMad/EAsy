import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {pool,closeDatabase} from '../src/db/client.js';
import {saveProfessor} from '../src/ingestion/ingest-professor.js';
import {withIngestionLock,PostgresRequestGate} from '../src/ingestion/control.js';
import {RmpGraphQlSource} from '../src/ingestion/rmp-source.js';
import {BudgetReached} from '../src/ingestion/http-client.js';
import {repository} from '../src/repository.js';
import type {IngestedProfessor} from '../src/ingestion/types.js';

const enabled=process.env.EASY_INTEGRATION_TEST==='true';
if(enabled && !new URL(process.env.DATABASE_URL!).pathname.endsWith('_test')) throw new Error('Integration tests require a dedicated database ending in _test.');
describe.skipIf(!enabled)('real PostgreSQL ingestion (synthetic inputs, no external requests)',()=>{
  beforeAll(async()=>{
    await pool.query("DELETE FROM ingestion_quarantine WHERE professor_id IN (SELECT id FROM professors WHERE rmp_professor_id IN ('fixture-normalization','fixture-isolated'))");
    await pool.query("DELETE FROM professors WHERE rmp_professor_id IN ('fixture-normalization','fixture-isolated')");
    await pool.query("DELETE FROM professors WHERE rmp_professor_id='fixture-cross-department'");
    await pool.query("DELETE FROM ingestion_quarantine WHERE professor_id IN (SELECT id FROM professors WHERE rmp_professor_id IN ('fixture-professor','fixture-resume'))");
    await pool.query("DELETE FROM professors WHERE rmp_professor_id IN ('fixture-professor','fixture-resume')");
    await pool.query("DELETE FROM ingestion_queue WHERE source_id IN ('fixture-professor','fixture-resume')");
    await pool.query("DELETE FROM ingestion_page_cache WHERE professor_id='fixture-resume'");
  });
  afterAll(async()=>{await closeDatabase();});
  const professor:IngestedProfessor={sourceId:'fixture-professor',legacyId:80000001,name:'Integration Fixture',department:'Neuroscience',
    overallQuality:4,overallDifficulty:2,wouldTakeAgainPct:90,reviews:Array.from({length:6},(_,i)=>({
      sourceId:`fixture-review-${i}`,rawCourse:i===5?'80':i%2===0?'NROSCI0080':'NROSCI\u00a00080',
      datePosted:'2026-09-01T00:00:00Z',gradeReceived:i===0?null:'A-',difficultyRating:2,qualityRating:4,
      attendanceMandatory:false,rawCommentText:'PRIVATE INTEGRATION REVIEW. Open book exams.',
    }))};
  it('deduplicates reimports, preserves originals, quarantines ambiguous codes and scores five valid reviews',async()=>{
    await saveProfessor(professor,true);
    await saveProfessor(professor,true);
    expect(Number((await pool.query("SELECT count(*) FROM reviews WHERE rmp_review_id LIKE 'fixture-review-%'")).rows[0].count)).toBe(5);
    expect((await pool.query("SELECT raw_course FROM reviews WHERE rmp_review_id='fixture-review-0'")).rows[0].raw_course).toBe('NROSCI0080');
    expect((await pool.query("SELECT raw_course FROM ingestion_quarantine WHERE review_id='fixture-review-5'")).rows[0].raw_course).toBe('80');
    const rows=await repository.offerings('neuroscience');
    expect(rows).toHaveLength(1);
    expect(rows[0].courseCode).toBe('NROSCI 0080');
    expect(Number(rows[0].reviewCount)).toBe(5);
    expect(Number(rows[0].gradeResponseCount)).toBe(4);
    expect(Number(rows[0].score)).toBeGreaterThan(0);
    expect(JSON.stringify(rows)).not.toContain('PRIVATE INTEGRATION');
  });
  it('resolves a quarantined review offline and recomputes scores',async()=>{
    await saveProfessor({...professor,reviews:[professor.reviews[5]!]},false,{'fixture-review-5':'NROSCI 0080'});
    expect((await pool.query("SELECT 1 FROM ingestion_quarantine WHERE review_id='fixture-review-5'")).rowCount).toBe(0);
    expect(Number((await repository.offerings('neuroscience'))[0].reviewCount)).toBe(6);
  });
  it('moves misclassified reviews to the corrected offering without duplicating them',async()=>{
    await saveProfessor({...professor,reviews:[professor.reviews[0]!]},false,{'fixture-review-0':'CS 1530'});
    const rows=await repository.offerings('neuroscience');
    expect(Number(rows.find(r=>r.courseCode==='NROSCI 0080').reviewCount)).toBe(5);
    expect(rows.find(r=>r.courseCode==='CS 1530').score).toBeNull();
  });
  it('rolls back a failed save instead of leaving partially updated professor data',async()=>{
    await expect(saveProfessor({...professor,name:'SHOULD ROLLBACK',reviews:[{...professor.reviews[0]!,difficultyRating:99}]})).rejects.toThrow();
    expect((await pool.query("SELECT name FROM professors WHERE rmp_professor_id='fixture-professor'")).rows[0].name).toBe('Integration Fixture');
  });
  it('prevents overlapping workers and persists cooldowns across gate instances',async()=>{
    await withIngestionLock(async client=>{
      await expect(withIngestionLock(async()=>true)).rejects.toThrow('Another import');
      await new PostgresRequestGate(client).pause(new Date(Date.now()+86400000),null);
      await expect(new PostgresRequestGate(client).reserve()).rejects.toThrow('cooldown');
      await client.query("UPDATE ingestion_control SET next_request_at=now(),requests_today=0,blocked_reason=NULL WHERE source='rmp'");
      await new PostgresRequestGate(client).pause(new Date(),'HTTP 403 fixture block');
      await expect(new PostgresRequestGate(client).reserve()).rejects.toThrow('403');
      await client.query("UPDATE ingestion_control SET blocked_reason=NULL,requests_today=1000,request_day=(now() AT TIME ZONE 'UTC')::date WHERE source='rmp'");
      await expect(new PostgresRequestGate(client).reserve()).rejects.toBeInstanceOf(BudgetReached);
      await client.query("UPDATE ingestion_control SET requests_today=0 WHERE source='rmp'");
    });
  });
  it('resumes a cached review page without refetching it',async()=>{
    await withIngestionLock(async client=>{
      const id='fixture-resume';
      const page=(next:boolean)=>({node:{id,legacyId:80000002,firstName:'Resume',lastName:'Fixture',school:{legacyId:1247},department:'CS',
        avgRating:4,avgDifficulty:2,wouldTakeAgainPercent:80,ratings:{edges:[],pageInfo:{hasNextPage:next,endCursor:next?'page-2':null}}}});
      const source=new RmpGraphQlSource(client,1);
      const requests=vi.spyOn(source.http,'request').mockResolvedValueOnce(page(true)).mockRejectedValueOnce(new BudgetReached('test limit'));
      await expect(source.getProfessor(id)).rejects.toThrow('test limit');
      expect(requests).toHaveBeenCalledTimes(2);
      expect((await client.query('SELECT 1 FROM ingestion_page_cache WHERE professor_id=$1',[id])).rowCount).toBe(1);
      const resumed=new RmpGraphQlSource(client,1);
      const again=vi.spyOn(resumed.http,'request').mockResolvedValueOnce(page(false));
      expect((await resumed.getProfessor(id)).reviews).toEqual([]);
      expect(again).toHaveBeenCalledTimes(1);
      expect(again.mock.calls[0]?.[1]).toMatchObject({cursor:'page-2'});
      await saveProfessor(await resumed.getProfessor(id),true);
      expect((await client.query('SELECT 1 FROM ingestion_page_cache WHERE professor_id=$1',[id])).rowCount).toBe(0);
      expect((await client.query('SELECT last_completed_at FROM ingestion_queue WHERE source_id=$1',[id])).rows[0].last_completed_at).not.toBeNull();
    });
  });
  it('compares the same course across professor departments and stores expanded tags',async()=>{
    await saveProfessor({...professor,sourceId:'fixture-cross-department',legacyId:80000003,name:'Other Department',department:'Biology',reviews:[{
      ...professor.reviews[0]!,sourceId:'fixture-cross-review',rawCourse:'NROSCI0080',rawCommentText:'Online quizzes. Extra credit. No homework at all.',
    }]});
    const rows=await repository.offerings(null,'NROSCI 0080');
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map(r=>r.department))).toEqual(new Set(['Neuroscience','Biology']));
    expect(rows[0].score).not.toBeNull();
    expect(rows[1].score).toBeNull();
    expect(rows[1].tags).toEqual(expect.arrayContaining(['online_quizzes','extra_credit_offered','no_homework']));
    const courses=await repository.courses('1247');
    expect(courses.find(c=>c.courseCode==='NROSCI 0080').professorCount).toBe(2);
    expect(courses.some(c=>c.courseCode.startsWith('UNMAPPED '))).toBe(false);
  });
  it('denies a database role with no privileges access to raw review storage',async()=>{
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('CREATE ROLE easy_privacy_integration NOLOGIN');
      await client.query('SET LOCAL ROLE easy_privacy_integration');
      await expect(client.query('SELECT raw_comment_text FROM reviews')).rejects.toThrow(/permission denied/);
    } finally {await client.query('ROLLBACK');client.release();}
    const rows=await pool.query("SELECT relrowsecurity FROM pg_class WHERE relname IN ('reviews','ingestion_page_cache','ingestion_quarantine')");
    expect(rows.rows.every(r=>r.relrowsecurity)).toBe(true);
  });
  it('merges legacy typo offerings with an audit trail, preserves raw data and dates, and is repeatable',async()=>{
    const input:IngestedProfessor={...professor,sourceId:'fixture-normalization',legacyId:80000004,department:'Marketing',reviews:[
      {...professor.reviews[0]!,sourceId:'norm-canonical',rawCourse:'BUSMKT1040'},
      {...professor.reviews[0]!,sourceId:'norm-typo',rawCourse:'BSMKT1040'},
      {...professor.reviews[0]!,sourceId:'norm-context',rawCourse:'MKT1040'},
      {...professor.reviews[0]!,sourceId:'norm-ambiguous',rawCourse:'CALC12'},
    ]};
    await saveProfessor(input);
    const p=(await pool.query("SELECT * FROM professors WHERE rmp_professor_id='fixture-normalization'")).rows[0];
    const badCourse=(await pool.query("INSERT INTO courses(school_id,course_code) VALUES($1,'BSMKT 1040') ON CONFLICT(school_id,course_code) DO UPDATE SET course_code=EXCLUDED.course_code RETURNING id",[p.school_id])).rows[0].id;
    const badOffering=(await pool.query('INSERT INTO professor_course_offerings(professor_id,course_id) VALUES($1,$2) RETURNING id',[p.id,badCourse])).rows[0].id;
    await pool.query("UPDATE reviews SET offering_id=$1,normalization_version='pitt-v2' WHERE rmp_review_id='norm-typo'",[badOffering]);
    expect((await repository.courses('1247')).some(c=>c.courseCode==='BSMKT 1040')).toBe(false);
    const before=(await pool.query("SELECT id,raw_comment_text,raw_course,scraped_at FROM reviews WHERE rmp_review_id='norm-typo'")).rows[0];
    await saveProfessor(input);
    const after=(await pool.query("SELECT id,raw_comment_text,raw_course,scraped_at FROM reviews WHERE rmp_review_id='norm-typo'")).rows[0];
    expect(after).toEqual(before);
    expect((await pool.query("SELECT to_course_code,method FROM course_normalization_audit WHERE review_source_id='norm-typo' AND from_course_code='BSMKT 1040'")).rows).toEqual([{to_course_code:'BUSMKT 1040',method:'subject_typo'}]);
    expect((await repository.offerings(null,'BUSMKT 1040')).filter(r=>r.professorName===input.name)).toHaveLength(1);
    expect((await pool.query("SELECT payload->>'rawCommentText' AS text FROM ingestion_quarantine WHERE review_id='norm-ambiguous'")).rows[0].text).toBe(input.reviews[3]!.rawCommentText);
    const audits=(await pool.query('SELECT count(*) FROM course_normalization_audit WHERE professor_id=$1',[p.id])).rows[0].count;
    await saveProfessor(input);
    expect((await pool.query('SELECT count(*) FROM course_normalization_audit WHERE professor_id=$1',[p.id])).rows[0].count).toBe(audits);
    expect((await repository.offerings(null,'BSMKT 1040'))).toEqual([]);
  });
  it('does not borrow another professors course as evidence for an ambiguous label',async()=>{
    await saveProfessor({...professor,sourceId:'fixture-isolated',legacyId:80000005,reviews:[{
      ...professor.reviews[0]!,sourceId:'isolated-ambiguous',rawCourse:'MKT1040',
    }]});
    expect((await pool.query("SELECT 1 FROM ingestion_quarantine WHERE review_id='isolated-ambiguous'")).rowCount).toBe(1);
    expect((await pool.query("SELECT 1 FROM reviews WHERE rmp_review_id='isolated-ambiguous'")).rowCount).toBe(0);
  });
});
