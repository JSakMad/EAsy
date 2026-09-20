import { calculateEasyAScore, CLASS_PREFERENCES, type ClassPreference, type ScoringReview, type TagType } from '@easy-a/core';
import { pool } from './db/client.js';

// A broad preference such as "study materials" does not prove every related tag.
// Only one-to-one mappings feed the original class-structure component.
export function studentScoringTags(preferences: ClassPreference[]): TagType[] {
  return [...new Set(CLASS_PREFERENCES.filter(p => preferences.includes(p.id) && p.tags.length === 1).flatMap(p => [...p.tags]))];
}

export async function withStudentScores(rows: Record<string, any>[]) {
  if (!rows.length) return rows;
  const studentRows = (await pool.query<{ offering_id: string; received_a: boolean; difficulty: number; tags: ClassPreference[] }>(
    'SELECT offering_id,received_a,difficulty,tags FROM student_reviews WHERE offering_id=ANY($1::uuid[])', [rows.map(row => row.id)])).rows;
  if (!studentRows.length) return rows;
  const ids = [...new Set(studentRows.map(row => row.offering_id))];
  const importedRows = (await pool.query<{ offering_id: string; grade_received: string | null; difficulty_rating: string; tags: TagType[] }>(
    `SELECT r.offering_id,r.grade_received,r.difficulty_rating,
      coalesce(array_agg(DISTINCT t.tag_type) FILTER(WHERE t.tag_type IS NOT NULL),'{}') AS tags
     FROM reviews r LEFT JOIN tags t ON t.review_id=r.id WHERE r.offering_id=ANY($1::uuid[])
     GROUP BY r.id`, [ids])).rows;
  return rows.map(row => {
    const students = studentRows.filter(review => review.offering_id===row.id);
    if (!students.length) return row;
    const imported = importedRows.filter(review => review.offering_id===row.id);
    const all: ScoringReview[] = [
      ...imported.map(review => ({ gradeReceived: review.grade_received, difficultyRating: Number(review.difficulty_rating), tags: review.tags })),
      ...students.map(review => ({ gradeReceived: review.received_a ? 'A' : 'Other', difficultyRating: review.difficulty, tags: studentScoringTags(review.tags) })),
    ];
    const score = calculateEasyAScore(all);
    const tagEvidence: Partial<Record<TagType, number>> = {};
    const preferenceEvidence: Partial<Record<ClassPreference, number>> = {};
    for (const review of all) for (const tag of new Set(review.tags)) tagEvidence[tag]=(tagEvidence[tag] ?? 0)+1;
    for (const review of students) for (const tag of new Set(review.tags)) preferenceEvidence[tag]=(preferenceEvidence[tag] ?? 0)+1;
    return { ...row, score: score.score, gradeAPct: score.gradeAPct, gradeResponseCount: score.gradeResponseCount,
      avgDifficulty: score.avgDifficulty, tagBonus: score.tagBonus, reviewCount: score.reviewCount,
      gradeComponent: score.components.grade, difficultyComponent: score.components.difficulty, tagComponent: score.components.tags,
      tags: Object.keys(tagEvidence), tagEvidence, preferenceEvidence,
      importedReviewCount: imported.length, studentReviewCount: students.length, computedAt: null };
  });
}
