import {readFile} from 'node:fs/promises';
import {resolveCourseCode,trustedCourseCodes} from '@easy-a/core';
import type {IngestedReview} from './types.js';
export const aliases=JSON.parse(await readFile(new URL('../../../../config/course-aliases.json',import.meta.url),'utf8')) as Record<string,string>;
export const courseOverrides=JSON.parse(await readFile(new URL('../../../../config/review-course-overrides.json',import.meta.url),'utf8')) as Record<string,string>;

export function classifyProfessorReviews(reviews:IngestedReview[],overrides=courseOverrides,previousLabels:string[]=[]) {
  // Only explicit valid-subject labels or operator-reviewed overrides are evidence.
  // Do not let one inferred correction justify another; input order must not matter.
  const known=trustedCourseCodes([...previousLabels,...reviews.map(r=>r.rawCourse),
    ...reviews.flatMap(r=>overrides[r.sourceId]?[overrides[r.sourceId]!]:[])]);
  return new Map(reviews.map(review=>[review.sourceId,resolveCourseCode(review.rawCourse,{aliases,knownCourses:known,override:overrides[review.sourceId]})]));
}
