import {parseArgs} from 'node:util';
import {closeDatabase} from '../db/client.js';
import {withIngestionLock} from '../ingestion/control.js';
import {saveProfessor} from '../ingestion/ingest-professor.js';
import {classifyProfessorReviews} from '../ingestion/course-policy.js';
import type {IngestedReview} from '../ingestion/types.js';

// Local-only preview/apply. Original review data and scrape dates are preserved.
try {
  const {values}=parseArgs({options:{'dry-run':{type:'boolean',default:false}}});
  await withIngestionLock(async client=>{
    const summary={dryRun:values['dry-run'],reviewsExamined:0,moved:0,recovered:0,newlyQuarantined:0,unchanged:0,skippedWithoutOriginal:0};
    const changes=new Map<string,{from:string;to:string;method:string;reviews:number}>();
    const professors=await client.query('SELECT * FROM professors WHERE NOT is_demo ORDER BY rmp_professor_id');
    for(const p of professors.rows) {
      const rows=await client.query(`SELECT r.*,c.course_code FROM reviews r
        JOIN professor_course_offerings o ON o.id=r.offering_id JOIN courses c ON c.id=o.course_id WHERE o.professor_id=$1`,[p.id]);
      summary.skippedWithoutOriginal+=rows.rows.filter(r=>r.raw_course===null).length;
      const prior=new Map<string,string>(rows.rows.map(r=>[r.rmp_review_id,r.course_code]));
      const quarantined=await client.query('SELECT payload FROM ingestion_quarantine WHERE professor_id=$1',[p.id]);
      const reviews:IngestedReview[]=rows.rows.filter(r=>r.raw_course!==null).map(r=>({sourceId:r.rmp_review_id,rawCourse:r.raw_course,
        datePosted:r.date_posted?.toISOString()??null,scrapedAt:r.scraped_at.toISOString(),
        gradeReceived:r.grade_received,difficultyRating:Number(r.difficulty_rating),qualityRating:r.quality_rating===null?null:Number(r.quality_rating),
        attendanceMandatory:r.attendance_mandatory,rawCommentText:r.raw_comment_text}));
      reviews.push(...quarantined.rows.map(r=>r.payload as IngestedReview));
      const resolutions=classifyProfessorReviews(reviews);
      for(const review of reviews) {
        const resolution=resolutions.get(review.sourceId)!;
        const from=prior.get(review.sourceId)??null;
        const to=resolution.code;
        summary.reviewsExamined++;
        if(from===to)summary.unchanged++;
        else {
          if(!from)summary.recovered++;else if(!to)summary.newlyQuarantined++;else summary.moved++;
          const key=JSON.stringify([from,to,resolution.method]);
          const change=changes.get(key)??{from:from??'QUARANTINE',to:to??'QUARANTINE',method:resolution.method,reviews:0};
          change.reviews++;changes.set(key,change);
        }
      }
      if(!values['dry-run']) await saveProfessor({sourceId:p.rmp_professor_id,legacyId:p.rmp_legacy_id,name:p.name,department:p.department,
        overallQuality:p.overall_quality,overallDifficulty:p.overall_difficulty,wouldTakeAgainPct:p.would_take_again_pct,reviews});
    }
    console.table([...changes.values()]);
    console.log(JSON.stringify(summary,null,2));
    console.log(values['dry-run']?'Preview only. No review or course records changed.':'Reclassification complete. Raw reviews retained; affected scores recomputed; changes recorded in private audit storage.');
  });
} finally {await closeDatabase();}
