'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireStudentProfile } from '@/lib/profile-access';
import { extractSyllabus } from '@/lib/syllabus-file';
import { checkSyllabus, matchesSyllabus, SyllabusError, SYLLABUS_MAX_BYTES, type SyllabusState } from '@/lib/syllabus-check';
import { reserveSyllabusAttempt, saveSyllabusCheck, syllabusReview } from '@/lib/syllabus-store';

export async function uploadSyllabus(offeringId: string, _previous: SyllabusState, form: FormData): Promise<SyllabusState> {
  const { user } = await requireStudentProfile();
  try {
    const file = form.get('syllabus');
    if (!(file instanceof File) || file.size === 0 || file.size > SYLLABUS_MAX_BYTES) throw new SyllabusError('Choose a PDF or text file smaller than 2 MB.');
    const review = await syllabusReview(user.id, offeringId);
    await reserveSyllabusAttempt(user.id);
    const { text, bytes } = await extractSyllabus(file);
    if (!matchesSyllabus(text, review)) throw new SyllabusError(`This syllabus does not match ${review.courseCode} with ${review.professorName}, or its course title and instructor could not be confirmed. You may be on the wrong class page. Check the class and professor, or upload a different syllabus.`, true);
    const result = checkSyllabus(text, review.tags);
    await saveSyllabusCheck(review.reviewId, createHash('sha256').update(bytes).digest('hex'), result);
    revalidatePath(`/offerings/${offeringId}`);
    return { success: result.preferences.length ? `The course and professor match. ${result.preferences.length} of your reported features are supported by this syllabus. Check marks have been updated.` : 'The course and professor match, but we could not confidently confirm any of your reported tags. No check marks were added; this does not mean your review is wrong.' };
  } catch (error) {
    return error instanceof SyllabusError ? { error: error.message, mismatch: error.mismatch } : { error: 'Syllabus checking is temporarily unavailable. Please try again shortly.' };
  }
}
