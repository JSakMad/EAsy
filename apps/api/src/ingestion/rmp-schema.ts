import { z } from 'zod';
import type { IngestedReview } from './types.js';
export const pageInfoSchema = z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() });
const school = z.object({ legacyId: z.number().int() });
export const teacherSummarySchema = z.object({
  id: z.string().min(1), legacyId: z.number().int().positive(), firstName: z.string(), lastName: z.string(), school,
});
export const searchSchema = z.object({ newSearch: z.object({ teachers: z.object({
  edges: z.array(z.object({ node: teacherSummarySchema })), pageInfo: pageInfoSchema, resultCount: z.number().int().nonnegative(),
}) }) });
const ratingSchema = z.object({
  id: z.string().min(1), legacyId: z.number().int().optional(),
  class: z.string().nullable(), date: z.string().nullable(), grade: z.string().nullable(),
  difficultyRating: z.number().min(1).max(5), helpfulRating: z.number().nullable(), clarityRating: z.number().nullable(),
  attendanceMandatory: z.union([z.string(), z.boolean(), z.null()]), comment: z.string(),
});
export const teacherSchema = teacherSummarySchema.extend({
  department: z.string(), avgRating: z.number().nullable(), avgDifficulty: z.number().nullable(), wouldTakeAgainPercent: z.number().nullable(),
  ratings: z.object({ edges: z.array(z.object({ node: ratingSchema })), pageInfo: pageInfoSchema }),
});
export type TeacherPage = z.infer<typeof teacherSchema>;
export function nextCursor(page: z.infer<typeof pageInfoSchema>, seen: Set<string>): string | null {
  if (!page.hasNextPage) return null;
  if (!page.endCursor || seen.has(page.endCursor)) throw new Error('Invalid or repeated pagination cursor; stopping to prevent a request loop.');
  seen.add(page.endCursor);
  return page.endCursor;
}
export function mapReview(value: unknown): IngestedReview {
  const r = ratingSchema.parse(value);
  const q = [r.helpfulRating, r.clarityRating].filter((v): v is number => v !== null && v >= 1 && v <= 5);
  const text = String(r.attendanceMandatory ?? '').trim().toLowerCase();
  const date = r.date?.replace(/ \+0000 UTC$/, 'Z').replace(' ', 'T');
  if (date && !Number.isFinite(Date.parse(date))) throw new Error('Unrecognized review date; stopping instead of storing an invented date.');
  const grade = r.grade?.trim().toUpperCase() ?? '';
  return {
    sourceId: r.id, rawCourse: r.class ?? '', datePosted: date ? new Date(date).toISOString() : null,
    gradeReceived: /^[ABCDF][+-]?$/.test(grade) ? grade : null, difficultyRating: r.difficultyRating,
    qualityRating: q.length ? q.reduce((a,b) => a+b,0)/q.length : null,
    attendanceMandatory: ['false','non mandatory','not mandatory','optional'].includes(text) ? false
      : ['true','mandatory','required'].includes(text) ? true : null,
    rawCommentText: r.comment,
  };
}
