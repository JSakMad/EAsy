export const SCORE_WEIGHTS = { grade: 0.5, difficulty: 0.35, tags: 0.15 } as const;
export const MINIMUM_REVIEWS = 5;

export const TAG_TYPES = [
  "notecard_allowed", "open_book_exam", "online_exams", "no_cumulative_final",
  "curve_applied", "attendance_not_required", "easy_a_explicit_mention", "group_project_heavy",
  "online_quizzes",
  "unlimited_quiz_attempts",
  "take_home_exam",
  "unproctored_exam",
  "multiple_choice_only",
  "predictable_exam_format",
  "exam_reuses_old_questions",
  "provides_study_guide",
  "posts_slides_or_notes",
  "practice_exam_provided",
  "review_session_before_exam",
  "allows_past_exams",
  "drops_lowest_score",
  "extra_credit_offered",
  "generous_curve",
  "participation_based_grading",
  "effort_based_grading",
  "no_late_penalty",
  "light_homework_load",
  "no_homework",
  "flexible_deadlines",
  "few_graded_assignments",
  "gpa_booster_mention",
] as const;
export { TAG_LABELS, TAG_GROUPS } from './tag-metadata.js';
export type TagType = (typeof TAG_TYPES)[number];

export interface ScoringReview {
  gradeReceived: string | null;
  difficultyRating: number;
  tags: TagType[];
}

export interface ScoreBreakdown {
  score: number | null;
  gradeAPct: number | null;
  gradeResponseCount: number;
  avgDifficulty: number | null;
  distinctEaseTagCount: number;
  tagBonus: number;
  reviewCount: number;
  sufficientData: boolean;
  components: { grade: number; difficulty: number; tags: number };
}

export function isAGrade(grade: string): boolean {
  return /^(A|A-|A\+)$/.test(grade.trim().toUpperCase());
}

export function calculateEasyAScore(reviews: ScoringReview[]): ScoreBreakdown {
  const reviewCount = reviews.length;
  const grades = reviews.map((review) => review.gradeReceived).filter((grade): grade is string => Boolean(grade?.trim()));
  const gradeAPct = grades.length ? (grades.filter(isAGrade).length / grades.length) * 100 : null;
  const validDifficulties = reviews.map((review) => review.difficultyRating).filter((value) => value >= 1 && value <= 5);
  const avgDifficulty = validDifficulties.length
    ? validDifficulties.reduce((sum, value) => sum + value, 0) / validDifficulties.length
    : null;
  const distinctTags = new Set(reviews.flatMap((review) => review.tags));
  const tagBonus = Math.min(1, 0.15 * distinctTags.size);
  const gradeComponent = (gradeAPct ?? 0) / 100;
  const difficultyComponent = avgDifficulty === null ? 0 : (5 - avgDifficulty) / 4;
  const components = {
    grade: SCORE_WEIGHTS.grade * gradeComponent * 100,
    difficulty: SCORE_WEIGHTS.difficulty * difficultyComponent * 100,
    tags: SCORE_WEIGHTS.tags * tagBonus * 100,
  };
  return {
    score: reviewCount >= MINIMUM_REVIEWS ? components.grade + components.difficulty + components.tags : null,
    gradeAPct,
    gradeResponseCount: grades.length,
    avgDifficulty,
    distinctEaseTagCount: distinctTags.size,
    tagBonus,
    reviewCount,
    sufficientData: reviewCount >= MINIMUM_REVIEWS,
    components,
  };
}

export {normalizeCourseCode,resolveCourseCode,trustedCourseCodes,isCanonicalCourseCode,COURSE_NORMALIZATION_VERSION} from './course-normalization.js';
export {PITT_SUBJECTS,PITT_SUBJECT_CODES} from './subjects.js';

export interface TagRule { label: string; patterns: string[] }
export interface ExtractedTag { type: TagType; confidence: number; matchedText: string }

const NEGATION_WINDOW = /\b(?:not|never|no|wasn't|isn't|weren't|doesn't|didn't|don't|can't|cannot|without)\b/i;

export function extractTags(text: string, rules: Record<TagType, TagRule>): ExtractedTag[] {
  const normalized = text.replace(/[’]/g, "'");
  const found: ExtractedTag[] = [];
  for (const type of TAG_TYPES) {
    for (const pattern of rules[type]?.patterns ?? []) {
      for (const match of normalized.matchAll(new RegExp(pattern, 'gi'))) {
        const context = normalized.slice(Math.max(0, match.index - 60), match.index)
          .split(/[.!?;\n]|\bbut\b/i).at(-1)!.replace(/\bnot only\b/gi, '');
        const after = normalized.slice(match.index + match[0].length);
        if (NEGATION_WINDOW.test(context) || /^\s+(?:(?:is|was|are|were)\s+)?(?:not\s+(?:offered|provided|allowed|available)|(?:isn't|wasn't|aren't|weren't)\s+(?:offered|provided|allowed|available))/i.test(after)) continue;
        found.push({ type, confidence: 0.72, matchedText: match[0] });
        break;
      }
      if (found.some(tag => tag.type === type)) break;
    }
  }
  return found;
}
