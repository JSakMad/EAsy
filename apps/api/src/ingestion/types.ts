export interface IngestedReview {
  sourceId: string;
  rawCourse: string;
  datePosted: string | null;
  gradeReceived: string | null;
  difficultyRating: number;
  qualityRating: number | null;
  attendanceMandatory: boolean | null;
  rawCommentText: string;
  scrapedAt?: string;
}

export interface IngestedProfessor {
  sourceId: string;
  legacyId: number;
  name: string;
  department: string;
  overallQuality: number | null;
  overallDifficulty: number | null;
  wouldTakeAgainPct: number | null;
  reviews: IngestedReview[];
}

export interface ProfessorSummary { sourceId: string; legacyId: number; name: string }

export interface IngestionSource {
  readonly name: string;
  listProfessors(): Promise<ProfessorSummary[]>;
  getProfessor(sourceId: string): Promise<IngestedProfessor>;
}
