import { describe, expect, it } from 'vitest';
import { calculatePersonalScore } from './personal-score.js';

describe('personalized professor scores', () => {
  const offering = { score: 60, reviewCount: 20, tagEvidence: { online_quizzes: 3 } };
  it('boosts supported preferences enough to change ordering', () => {
    expect(calculatePersonalScore(offering, ['online_quizzes']).score).toBe(72);
    expect(calculatePersonalScore({ ...offering, score: 65, tagEvidence: {} }, ['online_quizzes']).score).toBe(65);
  });
  it('uses a smaller boost for an isolated mention', () => {
    expect(calculatePersonalScore({ ...offering, tagEvidence: { online_quizzes: 1 } }, ['online_quizzes']).score).toBe(64);
  });
  it('keeps missing evidence unknown and supports no-preference choices', () => {
    expect(calculatePersonalScore(offering, []).score).toBe(60);
    const missing = calculatePersonalScore({ ...offering, tagEvidence: {} }, ['online_quizzes']);
    expect(missing.score).toBe(60);
    expect(missing.unknown).toEqual(['Online quizzes']);
  });
  it('never infers online classes from online quizzes', () => {
    expect(calculatePersonalScore(offering, ['online_classes']).score).toBe(60);
    expect(calculatePersonalScore(offering, ['online_classes']).unavailable).toEqual(['Online classes']);
    expect(calculatePersonalScore(offering, ['online_classes', 'online_quizzes']).score).toBe(72);
  });
  it('does not double count repeated choices or related tags', () => {
    expect(calculatePersonalScore(offering, ['online_quizzes', 'online_quizzes']).score).toBe(72);
    expect(calculatePersonalScore({ ...offering, tagEvidence: { provides_study_guide: 1, posts_slides_or_notes: 1 } }, ['study_resources']).score).toBe(64);
  });
  it('keeps insufficient data unscored and stays within bounds', () => {
    expect(calculatePersonalScore({ ...offering, reviewCount: 4 }, ['online_quizzes']).score).toBeNull();
    expect(calculatePersonalScore({ ...offering, score: null }, ['online_quizzes']).score).toBeNull();
    expect(calculatePersonalScore({ ...offering, score: 100 }, ['online_quizzes']).score).toBe(100);
    expect(calculatePersonalScore({ ...offering, tagEvidence: { online_quizzes: Number.NaN } }, ['online_quizzes']).score).toBe(60);
  });
  it('handles numeric strings from PostgreSQL', () => {
    expect(calculatePersonalScore({ ...offering, score: '60.000' as unknown as number }, ['online_quizzes']).score).toBe(72);
  });
});
