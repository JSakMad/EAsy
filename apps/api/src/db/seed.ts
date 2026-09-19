import { calculateEasyAScore, type ScoringReview, type TagType } from "@easy-a/core";
import { closeDatabase, pool } from "./client.js";

const offerings = [
  { code:"CS 0007", title:"Introduction to Computer Programming", professor:"Jordan Lee", rmp:"demo-jordan", legacy:9000001, quality:4.6, tags:["online_exams","notecard_allowed","attendance_not_required","easy_a_explicit_mention"] as TagType[], grades:["A","A","A-","A","A","B","A"], difficulty:1.7 },
  { code:"CS 0441", title:"Discrete Structures", professor:"Taylor Brooks", rmp:"demo-taylor", legacy:9000002, quality:4.3, tags:["open_book_exam","curve_applied","attendance_not_required"] as TagType[], grades:["A","A-","B","A","A","B+","A-"], difficulty:2.2 },
  { code:"CS 0445", title:"Data Structures", professor:"Morgan Patel", rmp:"demo-morgan", legacy:9000003, quality:4.5, tags:["notecard_allowed","curve_applied"] as TagType[], grades:["A","B+","A-","B","A","B","A"], difficulty:2.5 },
  { code:"CS 0447", title:"Computer Organization & Assembly", professor:"Casey Nguyen", rmp:"demo-casey", legacy:9000004, quality:4.0, tags:["online_exams","no_cumulative_final","curve_applied","group_project_heavy"] as TagType[], grades:["A","B","B+","A-","C","A","B"], difficulty:2.4 },
  { code:"CS 1501", title:"Algorithm Implementation", professor:"Riley Thompson", rmp:"demo-riley", legacy:9000005, quality:4.7, tags:["open_book_exam"] as TagType[], grades:["A","A","A-"], difficulty:2.3 },
];

const client = await pool.connect();
try {
  await client.query("BEGIN");
  const school = await client.query<{id:string}>("SELECT id FROM schools WHERE rmp_school_id='1247'");
  if (!school.rows[0]) throw new Error("Run npm run db:migrate before seeding.");
  for (const item of offerings) {
    const professor = await client.query<{id:string}>(
      `INSERT INTO professors (school_id,name,department,rmp_professor_id,rmp_legacy_id,overall_quality,overall_difficulty,would_take_again_pct,is_demo)
       VALUES ($1,$2,'Computer Science',$3,$4,$5,$6,90,true) ON CONFLICT (rmp_professor_id) DO UPDATE SET name=EXCLUDED.name,is_demo=true RETURNING id`,
      [school.rows[0].id,item.professor,item.rmp,item.legacy,item.quality,item.difficulty],
    );
    const course = await client.query<{id:string}>(
      `INSERT INTO courses (school_id,course_code,course_title) VALUES ($1,$2,$3)
       ON CONFLICT (school_id,course_code) DO UPDATE SET course_title=EXCLUDED.course_title RETURNING id`,
      [school.rows[0].id,item.code,item.title],
    );
    const offering = await client.query<{id:string}>(
      `INSERT INTO professor_course_offerings (professor_id,course_id) VALUES ($1,$2)
       ON CONFLICT (professor_id,course_id) DO UPDATE SET professor_id=EXCLUDED.professor_id RETURNING id`,
      [professor.rows[0]!.id,course.rows[0]!.id],
    );
    const scoringReviews: ScoringReview[] = [];
    for (let index=0; index<item.grades.length; index++) {
      const reviewId = `${item.rmp}-${index+1}`;
      const review = await client.query<{id:string}>(
        `INSERT INTO reviews (offering_id,rmp_review_id,date_posted,grade_received,difficulty_rating,quality_rating,attendance_mandatory,raw_comment_text)
         VALUES ($1,$2,now()-($3 * interval '1 day'),$4,$5,$6,false,'Synthetic setup data — not sourced from RMP.')
         ON CONFLICT (rmp_review_id) DO UPDATE SET grade_received=EXCLUDED.grade_received RETURNING id`,
        [offering.rows[0]!.id,reviewId,index*30,item.grades[index],item.difficulty,item.quality],
      );
      const reviewTags = index === 0 ? item.tags : [];
      scoringReviews.push({ gradeReceived:item.grades[index]!,difficultyRating:item.difficulty,tags:reviewTags });
      for (const tag of reviewTags) await client.query(
        `INSERT INTO tags (review_id,tag_type,source,confidence) VALUES ($1,$2,'extracted_from_comment',0.72)
         ON CONFLICT (review_id,tag_type,source) DO NOTHING`, [review.rows[0]!.id,tag],
      );
    }
    const score = calculateEasyAScore(scoringReviews);
    await client.query(
      `INSERT INTO easy_a_score_snapshots (offering_id,score,grade_a_pct,grade_response_count,avg_difficulty,tag_bonus,review_count,grade_component,difficulty_component,tag_component)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [offering.rows[0]!.id,score.score,score.gradeAPct,score.gradeResponseCount,score.avgDifficulty,score.tagBonus,score.reviewCount,score.components.grade,score.components.difficulty,score.components.tags],
    );
  }
  await client.query("COMMIT");
  console.log("Inserted five clearly labeled synthetic demo offerings.");
} catch (error) { await client.query("ROLLBACK"); throw error; }
finally { client.release(); await closeDatabase(); }
