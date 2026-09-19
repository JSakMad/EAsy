import type { TagType } from './index.js';

export const CLASS_PREFERENCES = [
  { id: 'online_quizzes', label: 'Online quizzes', tags: ['online_quizzes'] },
  { id: 'online_classes', label: 'Online classes', tags: [] },
  { id: 'online_exams', label: 'Online exams', tags: ['online_exams'] },
  { id: 'open_book_exams', label: 'Open-book exams', tags: ['open_book_exam'] },
  { id: 'optional_attendance', label: 'Optional attendance', tags: ['attendance_not_required'] },
  { id: 'flexible_deadlines', label: 'Flexible deadlines', tags: ['flexible_deadlines', 'no_late_penalty'] },
  { id: 'group_projects', label: 'Group projects', tags: ['group_project_heavy'] },
  { id: 'study_resources', label: 'Provided study materials', tags: ['provides_study_guide', 'posts_slides_or_notes', 'practice_exam_provided'] },
  { id: 'lighter_homework', label: 'Less homework', tags: ['light_homework_load', 'no_homework'] },
  { id: 'quiz_retakes', label: 'Quiz retakes', tags: ['unlimited_quiz_attempts'] },
  { id: 'extra_credit', label: 'Extra credit', tags: ['extra_credit_offered'] },
  { id: 'no_cumulative_final', label: 'No cumulative final', tags: ['no_cumulative_final'] },
] as const satisfies readonly { id: string; label: string; tags: readonly TagType[] }[];

export type ClassPreference = (typeof CLASS_PREFERENCES)[number]['id'];
export type TagEvidence = Partial<Record<TagType, number>>;
export const PERSONAL_SCORE_WEIGHT = 0.3;

export function calculatePersonalScore(
  offering: { score: number | null; reviewCount: number; tagEvidence?: TagEvidence },
  preferences: readonly ClassPreference[],
) {
  const selected = CLASS_PREFERENCES.filter(p => preferences.includes(p.id));
  const supported = selected.filter(p => p.tags.length > 0);
  const matches = supported.flatMap(preference => {
    // Related tags may describe the same reviews, so use the largest count rather than adding them.
    const mentions = Math.max(0, ...preference.tags.map(tag => {
      const count = offering.tagEvidence?.[tag];
      return typeof count === 'number' && Number.isFinite(count) ? Math.min(offering.reviewCount, Math.max(0, count)) : 0;
    }));
    return mentions > 0 ? [{ id: preference.id, label: preference.label, mentions, strength: Math.min(1, mentions / 3) }] : [];
  });
  const coverage = supported.length ? matches.reduce((sum, match) => sum + match.strength, 0) / supported.length : 0;
  // PostgreSQL numeric fields may arrive as JSON strings through the public API.
  const base = offering.score === null ? null : Number(offering.score);
  const score = base === null || !Number.isFinite(base) || offering.reviewCount < 5 ? null
    : Math.max(0, Math.min(100, base + (100 - base) * PERSONAL_SCORE_WEIGHT * coverage));
  return {
    score,
    bonus: score === null || base === null ? 0 : score - base,
    matches,
    unknown: supported.filter(p => !matches.some(m => m.id === p.id)).map(p => p.label),
    unavailable: selected.filter(p => p.tags.length === 0).map(p => p.label),
    coverage,
  };
}
