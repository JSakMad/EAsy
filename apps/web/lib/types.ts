import type { TagType, TagEvidence, ClassPreference } from "@easy-a/core";

export interface Department { id: string; name: string; offeringCount: number }
export interface Course {courseCode:string;courseTitle:string|null;professorCount:number;reviewCount:number}
export interface Overview {
  status:'ready'|'pending'|'stale'|'insufficient'|'unavailable';
  totalReviews?:number;provider?:string;retryAfter?:number;reason?:string;sourceChanged?:boolean;truncatedCount?:number;
  stats:{reviewCount:number;datedCount:number;undatedCount:number;futureDatedCount:number;oldestReviewAt:string|null;newestReviewAt:string|null;reviewsInLast24Months:number;asOf:string};
  generatedAt?:string;model?:string;
  overview?:{summary:string;easierFactors:string[];harderFactors:string[];studyAdvice:string[];changesOverTime:string};
}
export interface Offering {
  id: string;
  courseCode: string;
  courseTitle: string | null;
  professorName: string;
  department: string;
  score: number | null;
  gradeAPct: number | null;
  gradeResponseCount: number;
  avgDifficulty: number | null;
  tagBonus: number;
  reviewCount: number;
  gradeComponent: number;
  difficultyComponent: number;
  tagComponent: number;
  tags: TagType[];
  tagEvidence?: TagEvidence;
  preferenceEvidence?: Partial<Record<ClassPreference, number>>;
  importedReviewCount?: number;
  studentReviewCount?: number;
  rmpUrl?: string | null;
  overallQuality?: number | null;
  wouldTakeAgainPct?: number | null;
  computedAt?: string;
}
