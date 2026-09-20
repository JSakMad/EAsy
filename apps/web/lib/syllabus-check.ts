import type { ClassPreference, TagType } from '@easy-a/core';

export const SYLLABUS_MAX_BYTES = 2 * 1024 * 1024;
export type SyllabusResult = { preferences: ClassPreference[]; tags: TagType[] };
export type SyllabusState = { error?: string; mismatch?: boolean; success?: string };
export class SyllabusError extends Error {
  constructor(message: string, public mismatch = false) { super(message); }
}
