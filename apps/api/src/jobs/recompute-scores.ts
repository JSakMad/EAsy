import { calculateEasyAScore, type ScoringReview, type TagType } from "@easy-a/core";
import { closeDatabase, pool } from "../db/client.js";
import type { Pool, PoolClient } from 'pg';

export async function recomputeScores(offeringIds?: string[], db: Pool | PoolClient = pool) {
  if (offeringIds && !offeringIds.length) return 0;
  const offerings = await db.query<{ id: string }>(
    offeringIds ? "SELECT id FROM professor_course_offerings WHERE id = ANY($1::uuid[])" : "SELECT id FROM professor_course_offerings",
    offeringIds ? [offeringIds] : [],
  );
  let computed = 0;
  for (const { id } of offerings.rows) {
    const rows = await db.query<{ id: string; grade_received: string | null; difficulty_rating: string; tags: TagType[] | null }>(
      `SELECT r.id,r.grade_received,r.difficulty_rating::text,array_remove(array_agg(t.tag_type),NULL) AS tags
       FROM reviews r LEFT JOIN tags t ON t.review_id=r.id WHERE r.offering_id=$1
       GROUP BY r.id,r.grade_received,r.difficulty_rating`, [id],
    );
    const reviews: ScoringReview[] = rows.rows.map((row) => ({
      gradeReceived: row.grade_received,
      difficultyRating: Number(row.difficulty_rating),
      tags: row.tags ?? [],
    }));
    const score = calculateEasyAScore(reviews);
    await db.query(
      `INSERT INTO easy_a_score_snapshots
       (offering_id,score,grade_a_pct,grade_response_count,avg_difficulty,tag_bonus,review_count,grade_component,difficulty_component,tag_component)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, score.score, score.gradeAPct, score.gradeResponseCount, score.avgDifficulty, score.tagBonus,
       score.reviewCount, score.components.grade, score.components.difficulty, score.components.tags],
    );
    computed++;
  }
  return computed;
}

if (process.argv[1]?.endsWith("recompute-scores.ts") || process.argv[1]?.endsWith("recompute-scores.js")) {
  const computed = await recomputeScores();
  console.log(`Wrote ${computed} score snapshots.`);
  await closeDatabase();
}
