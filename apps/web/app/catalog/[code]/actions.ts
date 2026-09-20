'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStudentProfile } from '@/lib/profile-access';
import { getCatalogCourse } from '@/lib/catalog';
import { validateReview, type ReviewFormState } from '@/lib/review-fields';
import { saveStudentReview, ReviewWriteError } from '@/lib/student-reviews';

export async function submitReview(code: string, _previous: ReviewFormState, form: FormData): Promise<ReviewFormState> {
  const { user } = await requireStudentProfile();
  const course = getCatalogCourse(code);
  if (!course) return { error: 'Choose a course from the catalog.' };
  const parsed = validateReview(form);
  if (!parsed.data) return { error: parsed.error };
  let offeringId: string;
  try { ({ offeringId } = await saveStudentReview(user.id, course, parsed.data)); }
  catch (error) { return { error: error instanceof ReviewWriteError ? error.message : 'We could not save your review. Please try again.' }; }
  revalidatePath('/');
  revalidatePath(`/offerings/${offeringId}`);
  revalidatePath(`/catalog/${encodeURIComponent(course.code)}`);
  redirect(`/catalog/${encodeURIComponent(course.code)}?submitted=1`);
}
