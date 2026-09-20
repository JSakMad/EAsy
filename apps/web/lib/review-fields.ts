import { CLASS_PREFERENCES, type ClassPreference } from '@easy-a/core';
export type ReviewInput = { professorId: string; professorName: string; receivedA: boolean; difficulty: number; tags: ClassPreference[]; comments: string };
export type ReviewFormState = { error?: string };

export function validateReview(form: FormData): { data?: ReviewInput; error?: string } {
  const read = (key: string) => typeof form.get(key) === 'string' ? (form.get(key) as string).trim() : '';
  const professorId = read('professorId');
  const professorName = read('professorName').replace(/\s+/g, ' ');
  if (professorId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(professorId)) return { error: 'Choose a valid professor.' };
  if (!professorId && (professorName.length < 2 || professorName.length > 120)) return { error: 'Enter your professor’s name (2–120 characters).' };
  const grade = read('receivedA');
  if (!['yes', 'no'].includes(grade)) return { error: 'Select whether you received an A or A−.' };
  const difficulty = read('difficulty');
  if (!/^[1-5]$/.test(difficulty)) return { error: 'Choose a difficulty from 1 to 5.' };
  const tags = form.getAll('tags');
  if (tags.length > CLASS_PREFERENCES.length || tags.some(tag => !CLASS_PREFERENCES.some(p => p.id === tag))) return { error: 'Choose only the listed class features.' };
  const comments = read('comments');
  if (comments.length > 3000) return { error: 'Keep comments to 3,000 characters or fewer.' };
  return { data: { professorId, professorName, receivedA: grade === 'yes', difficulty: Number(difficulty), tags: [...new Set(tags)] as ClassPreference[], comments } };
}
