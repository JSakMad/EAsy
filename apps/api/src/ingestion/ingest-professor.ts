import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractTags, COURSE_NORMALIZATION_VERSION, type TagRule, type TagType } from "@easy-a/core";
import {classifyProfessorReviews,courseOverrides} from './course-policy.js';
import { pool } from "../db/client.js";
import { config } from "../config.js";
import type { IngestionSource, IngestedProfessor } from "./types.js";
import { recomputeScores } from '../jobs/recompute-scores.js';

const root = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const tagRules = JSON.parse(await readFile(resolve(root, "config/tags.json"), "utf8")) as Record<TagType, TagRule>;

export async function ingestProfessor(source: IngestionSource, sourceId: string) {
  const professor = await source.getProfessor(sourceId);
  return saveProfessor(professor, source.name === 'rmp_graphql');
}

export async function saveProfessor(professor: IngestedProfessor, completeSource = false, overrides = courseOverrides) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const school = await client.query<{ id: string }>(
      `INSERT INTO schools (name, rmp_school_id) VALUES ($1, $2)
       ON CONFLICT (rmp_school_id) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      ["University of Pittsburgh", config.RMP_SCHOOL_LEGACY_ID],
    );
    const schoolId = school.rows[0]!.id;
    const professorRow = await client.query<{ id: string }>(
      `INSERT INTO professors (school_id, name, department, rmp_professor_id, rmp_legacy_id, overall_quality, overall_difficulty, would_take_again_pct)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (rmp_professor_id) DO UPDATE SET name=EXCLUDED.name, department=EXCLUDED.department,
       overall_quality=EXCLUDED.overall_quality, overall_difficulty=EXCLUDED.overall_difficulty,
       would_take_again_pct=EXCLUDED.would_take_again_pct RETURNING id`,
      [schoolId, professor.name, professor.department, professor.sourceId, professor.legacyId, professor.overallQuality, professor.overallDifficulty, professor.wouldTakeAgainPct],
    );
    const professorId = professorRow.rows[0]!.id;
    const oldOfferings = await client.query<{id:string}>('SELECT id FROM professor_course_offerings WHERE professor_id=$1',[professorId]);
    const offeringIds = new Set(oldOfferings.rows.map(r => r.id));
    let quarantined = 0;
    const priorLabels=await client.query(`SELECT r.raw_course FROM reviews r JOIN professor_course_offerings o ON o.id=r.offering_id
      WHERE o.professor_id=$1 AND r.raw_course IS NOT NULL`,[professorId]);
    const classifications=classifyProfessorReviews(professor.reviews,overrides,priorLabels.rows.map(r=>r.raw_course));

    for (const review of professor.reviews) {
      const resolution=classifications.get(review.sourceId)!;
      const courseCode=resolution.code;
      const previous = await client.query(`SELECT r.id,r.scraped_at,r.normalization_version,o.professor_id,c.course_code FROM reviews r
        JOIN professor_course_offerings o ON o.id=r.offering_id JOIN courses c ON c.id=o.course_id WHERE r.rmp_review_id=$1`, [review.sourceId]);
      if (previous.rows[0] && previous.rows[0].professor_id !== professorId) throw new Error('Review belongs to a different professor. Import stopped.');
      const oldQuarantine=(await client.query('SELECT professor_id,reason,normalization_version,payload FROM ingestion_quarantine WHERE review_id=$1',[review.sourceId])).rows[0];
      if(oldQuarantine&&oldQuarantine.professor_id!==professorId)throw new Error('Quarantined review belongs to a different professor.');
      if((previous.rows[0]?.course_code??null)!==courseCode||(!previous.rows[0]&&!oldQuarantine)||
        (previous.rows[0]&&previous.rows[0].normalization_version!==COURSE_NORMALIZATION_VERSION)||
        (oldQuarantine&&(oldQuarantine.normalization_version!==COURSE_NORMALIZATION_VERSION||oldQuarantine.reason!==resolution.reason))) {
        await client.query(`INSERT INTO course_normalization_audit(professor_id,review_source_id,raw_course,from_course_code,to_course_code,method,reason,candidates,policy_version)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[professorId,review.sourceId,review.rawCourse,previous.rows[0]?.course_code??null,courseCode,resolution.method,resolution.reason,JSON.stringify(resolution.candidates),COURSE_NORMALIZATION_VERSION]);
      }
      if (!courseCode) {
        const savedReview={...review,scrapedAt:previous.rows[0]?.scraped_at?.toISOString()??review.scrapedAt??oldQuarantine?.payload?.scrapedAt??new Date().toISOString()};
        await client.query(`INSERT INTO ingestion_quarantine(review_id,professor_id,raw_course,reason,payload,candidates,normalization_version)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
          ON CONFLICT(review_id) DO UPDATE SET raw_course=EXCLUDED.raw_course,reason=EXCLUDED.reason,payload=EXCLUDED.payload,
          candidates=EXCLUDED.candidates,normalization_version=EXCLUDED.normalization_version,updated_at=now()`,
          [review.sourceId,professorId,review.rawCourse,resolution.reason,JSON.stringify(savedReview),JSON.stringify(resolution.candidates),COURSE_NORMALIZATION_VERSION]);
        // Move a previously misclassified review to quarantine; its full data is retained there.
        await client.query('DELETE FROM reviews WHERE rmp_review_id=$1', [review.sourceId]);
        quarantined++;
        continue;
      }
      const course = await client.query<{ id: string }>(
        `INSERT INTO courses (school_id, course_code) VALUES ($1,$2)
         ON CONFLICT (school_id, course_code) DO UPDATE SET course_code=EXCLUDED.course_code RETURNING id`,
        [schoolId, courseCode],
      );
      const offering = await client.query<{ id: string }>(
        `INSERT INTO professor_course_offerings (professor_id, course_id) VALUES ($1,$2)
         ON CONFLICT (professor_id, course_id) DO UPDATE SET professor_id=EXCLUDED.professor_id RETURNING id`,
        [professorId, course.rows[0]!.id],
      );
      const offeringId = offering.rows[0]!.id;
      offeringIds.add(offeringId);
      const insertedReview = await client.query<{ id: string }>(
        `INSERT INTO reviews (offering_id,rmp_review_id,date_posted,grade_received,difficulty_rating,quality_rating,attendance_mandatory,raw_comment_text,raw_course,normalization_version,normalization_method,scraped_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,COALESCE($12::timestamptz,now()))
         ON CONFLICT (rmp_review_id) DO UPDATE SET offering_id=EXCLUDED.offering_id,date_posted=EXCLUDED.date_posted,
         grade_received=EXCLUDED.grade_received,difficulty_rating=EXCLUDED.difficulty_rating,quality_rating=EXCLUDED.quality_rating,
         attendance_mandatory=EXCLUDED.attendance_mandatory,raw_comment_text=EXCLUDED.raw_comment_text,
         raw_course=EXCLUDED.raw_course,normalization_version=EXCLUDED.normalization_version,normalization_method=EXCLUDED.normalization_method,
         scraped_at=CASE WHEN $13 THEN now() ELSE reviews.scraped_at END RETURNING id`,
        [offeringId, review.sourceId, review.datePosted, review.gradeReceived, review.difficultyRating, review.qualityRating, review.attendanceMandatory, review.rawCommentText,review.rawCourse,
          COURSE_NORMALIZATION_VERSION,resolution.method,review.scrapedAt??oldQuarantine?.payload?.scrapedAt??null,completeSource],
      );
      const reviewId = insertedReview.rows[0]!.id;
      await client.query('DELETE FROM ingestion_quarantine WHERE review_id=$1', [review.sourceId]);
      await client.query("DELETE FROM tags WHERE review_id=$1", [reviewId]);
      const extracted = extractTags(review.rawCommentText, tagRules);
      if (review.attendanceMandatory === false && !extracted.some((tag) => tag.type === "attendance_not_required")) {
        extracted.push({ type: "attendance_not_required", confidence: 1, matchedText: "native attendance field" });
      }
      for (const tag of extracted) {
        const sourceName = tag.matchedText === "native attendance field" ? "native_rmp" : "extracted_from_comment";
        await client.query(
          `INSERT INTO tags (review_id,tag_type,source,confidence) VALUES ($1,$2,$3,$4)
           ON CONFLICT (review_id,tag_type,source) DO UPDATE SET confidence=EXCLUDED.confidence`,
          [reviewId, tag.type, sourceName, tag.confidence],
        );
      }
    }
    await recomputeScores([...offeringIds],client);
    if (completeSource) {
      await client.query(`INSERT INTO ingestion_queue(source_id,legacy_id,name,last_completed_at) VALUES ($1,$2,$3,now())
        ON CONFLICT(source_id) DO UPDATE SET last_completed_at=now(),last_error=NULL`, [professor.sourceId,professor.legacyId,professor.name]);
      await client.query('DELETE FROM ingestion_page_cache WHERE professor_id=$1', [professor.sourceId]);
    }
    await client.query("COMMIT");
    return { professor: professor.name, reviews: professor.reviews.length, quarantined, offeringIds: [...offeringIds] };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
