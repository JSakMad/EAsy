import {readFile} from 'node:fs/promises';
import {extractTags,type TagRule,type TagType} from '@easy-a/core';
import {withIngestionLock} from '../ingestion/control.js';
import {closeDatabase} from '../db/client.js';
import {recomputeScores} from './recompute-scores.js';

// Offline only: preserve comments, course assignments, source checkpoints, and scrape dates.
const rules=JSON.parse(await readFile(new URL('../../../../config/tags.json',import.meta.url),'utf8')) as Record<TagType,TagRule>;
try {
  await withIngestionLock(async client=>{
    const professors=await client.query('SELECT id FROM professors WHERE NOT is_demo');
    let reviewCount=0;
    let tagCount=0;
    for(const professor of professors.rows) {
      await client.query('BEGIN');
      try {
        const reviews=await client.query(`SELECT r.id,r.raw_comment_text,r.attendance_mandatory FROM reviews r
          JOIN professor_course_offerings o ON o.id=r.offering_id WHERE o.professor_id=$1`,[professor.id]);
        for(const review of reviews.rows) {
          const tags=extractTags(review.raw_comment_text,rules);
          if(review.attendance_mandatory===false && !tags.some(t=>t.type==='attendance_not_required'))
            tags.push({type:'attendance_not_required',confidence:1,matchedText:'native attendance field'});
          await client.query('DELETE FROM tags WHERE review_id=$1',[review.id]);
          for(const tag of tags) await client.query('INSERT INTO tags(review_id,tag_type,source,confidence) VALUES($1,$2,$3,$4)',
            [review.id,tag.type,tag.matchedText==='native attendance field'?'native_rmp':'extracted_from_comment',tag.confidence]);
          reviewCount++;tagCount+=tags.length;
        }
        const offerings=await client.query('SELECT id FROM professor_course_offerings WHERE professor_id=$1',[professor.id]);
        await recomputeScores(offerings.rows.map(r=>r.id),client);
        await client.query('COMMIT');
      } catch(error) {await client.query('ROLLBACK');throw error;}
    }
    console.log(`Offline retag complete: ${reviewCount} reviews, ${tagCount} tags. No source requests or course reassignment.`);
  });
} finally {await closeDatabase();}
