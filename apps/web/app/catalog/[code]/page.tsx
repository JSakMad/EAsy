import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { ReviewForm } from '@/components/review-form';
import { getCatalogCourse } from '@/lib/catalog';
import { checkStudentSetup } from '@/lib/profile-access';
import { getProfessorChoices, type ProfessorChoice } from '@/lib/student-reviews';

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const course = getCatalogCourse((await params).code);
  return { title: course ? course.code + ' - Leave a review' : 'Course not found' };
}

export default async function ReviewPage({ params, searchParams }: {
  params: Promise<{ code: string }>; searchParams: Promise<{ submitted?: string }>;
}) {
  const course = getCatalogCourse((await params).code);
  if (!course) notFound();
  const profile = await checkStudentSetup();
  const query = await searchParams;
  let professors: ProfessorChoice[] = [];
  let unavailable = false;
  if (profile) {
    try { professors = await getProfessorChoices(); }
    catch { unavailable = true; }
  }
  return <main className="shell catalog-main"><SiteHeader />
    <Link className="auth-back" href={'/?'+new URLSearchParams({course:course.code})}>Back to course</Link>
    <section className="catalog-intro"><p className="section-kicker">{course.code}</p><h1>{course.title}</h1></section>
    {query.submitted==='1' ? <section className="auth-card"><h2>Thank you for your review</h2><p role="status">Your feedback has been saved and contributes to professor scores and AI overviews.</p><Link href={'/?'+new URLSearchParams({course:course.code})}>Compare professors</Link></section>
    : <section className="auth-card" aria-labelledby="add-review-title"><h2 id="add-review-title">Review this class</h2>
      {!profile ? <><p>Sign in and complete your profile to submit a review.</p><Link className="auth-button" href="/sign-in">Sign in to review</Link></>
        : unavailable ? <p>Review submissions are temporarily unavailable. Please try again shortly.</p> : <ReviewForm code={course.code} professors={professors} />}
    </section>}
  </main>;
}
