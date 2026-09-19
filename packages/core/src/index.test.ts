import { describe, expect, it } from "vitest";
import rules from "../../../config/tags.json";
import { calculateEasyAScore, extractTags, normalizeCourseCode, type ScoringReview, type TagRule, type TagType } from "./index.js";

describe("calculateEasyAScore", () => {
  it("implements the specified 50/35/15 formula", () => {
    const reviews: ScoringReview[] = Array.from({ length: 10 }, (_, index) => ({
      gradeReceived: index < 8 ? "A" : index === 8 ? "B" : null,
      difficultyRating: 2,
      tags: index === 0 ? ["notecard_allowed", "online_exams"] : [],
    }));
    const result = calculateEasyAScore(reviews);
    expect(result.gradeResponseCount).toBe(9);
    expect(result.gradeAPct).toBeCloseTo(88.888, 2);
    expect(result.components.grade).toBeCloseTo(44.444, 2);
    expect(result.components.difficulty).toBeCloseTo(26.25, 2);
    expect(result.components.tags).toBeCloseTo(4.5, 2);
    expect(result.score).toBeCloseTo(75.194, 2);
  });

  it("does not score offerings below five reviews", () => {
    expect(calculateEasyAScore(Array(4).fill({ gradeReceived: "A", difficultyRating: 1, tags: [] })).score).toBeNull();
  });
});

describe("normalization and extraction", () => {
  it.each(['NROSCI0080','NROSCI 0080','NROSCI\u00a00080','nrosci 80','NROSCI-0080'])('normalizes %s without losing subject or leading zeroes', raw => {
    expect(normalizeCourseCode(raw,{})).toBe('NROSCI 0080');
  });
  it.each(['CS1530','CS 1530','cs\t1530'])('normalizes %s', raw => {
    expect(normalizeCourseCode(raw,{})).toBe('CS 1530');
  });
  it.each(['0080','0447','CS15300','took CS1530 and CS0447',''])('does not guess ambiguous or malformed code %s', raw => {
    expect(normalizeCourseCode(raw,{'0447':'CS 0447'})).toMatch(/^UNMAPPED /);
  });
  it("normalizes aliases and common course code formats", () => {
    expect(normalizeCourseCode("CS447", { CS447: "CS 0447" })).toBe("CS 0447");
    expect(normalizeCourseCode("math 220", {})).toBe("MATH 0220");
  });

  it("extracts positive phrases and rejects ordinary negation", () => {
    const typedRules = rules as Record<TagType, TagRule>;
    expect(extractTags("We had an open book exam and one page of notes.", typedRules).map((tag) => tag.type)).toEqual(["notecard_allowed", "open_book_exam"]);
    expect(extractTags("It was not an open book exam.", typedRules).map((tag) => tag.type)).not.toContain("open_book_exam");
  });
});
