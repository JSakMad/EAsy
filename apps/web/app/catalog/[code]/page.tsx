import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CLASS_PREFERENCES } from '@easy-a/core';
import { SiteHeader } from '@/components/site-header';
import { ReviewForm } from '@/components/review-form';
import { getCatalogCourse } from '@/lib/catalog';
import { checkStudentSetup } from '@/lib/profile-access';
import { getCourseReviews, getProfessorChoices, type ProfessorChoice } from '@/lib/student-reviews';

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const course = getCatalogCourse((await params).code);
  return { title: course ? `${course.code} — Student reviews` : 'Course not found' };
}

export default async function CatalogCoursePage({ params, searchParams }: {
  params: Promise<{ code: string }>; searchParams: Promise<{ page?: string; submitted?: string }>;
}) {
  const course = getCatalogCourse((await params).code);
  if (!course) notFound();
  const profile = await checkStudentSetup();
  const query = await searchParams;
  let data: Awaited<ReturnType<typeof getCourseReviews>> | null = null;
  let professors: ProfessorChoice[] = [];
  try {
    [data,professors] = await Promise.all([getCourseReviews(course.code,Number(query.page ?? 1)),profile ? getProfessorChoices() : Promise.resolve([])]);
  } catch { /* The catalog stays readable if review storage is temporarily unavailable. */ }
  const url = `/catalog/${encodeURIComponent(course.code)}`;
  return <main className="shell catalog-main"><SiteHeader />
    <Link className="auth-back" href="/catalog">← Course catalog</Link>
    <section className="catalog-intro"><p className="section-kicker">{course.code}</p><h1>{course.title}</h1>
      <div className="catalog-fields">{course.fieldsOfStudy.map(field => <Link key={field} href={'/catalog?'+new URLSearchParams({field})}>{field}</Link>)}</div>
      <p><Link className="auth-back" href={'/?'+new URLSearchParams({course:course.code})}>Compare professors for this course →</Link></p>
    </section>
    {query.submitted==='1' && <p role="status" className="review-success">Your review was submitted. It now contributes to this professor’s course score.</p>}
    <div className="catalog-review-layout"><section aria-labelledby="student-reviews-title">
      <h2 id="student-reviews-title">EAsy student reviews</h2>
      <p>Firsthand reviews submitted here. Imported reviews contribute to professor comparisons; their comments are not republished.</p>
      {!data ? <p role="status">Reviews are temporarily unavailable. Please try again shortly.</p> : <>
        <p className="review-summary">{data.summary.total} review{data.summary.total===1?'':'s'}{data.summary.total>0 && <> · {Math.round(data.summary.aPercent!)}% reported A/A− · {data.summary.difficulty!.toFixed(1)}/5 difficulty</>}</p>
        {data.reviews.length===0 && <p className="catalog-empty">No student reviews yet. Be the first to share your experience.</p>}
        {data.reviews.map(review => <article className="student-review" key={review.id}>
          <h3>{review.professorName}</h3><p className="review-date">Submitted <time dateTime={review.submittedAt.toISOString()}>{new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeZone:'UTC'}).format(review.submittedAt)}</time> (UTC)</p>
          <p>{review.receivedA?'Reported an A or A−':'Did not report an A or A−'} · Difficulty {review.difficulty}/5</p>
          <div className="catalog-fields">{CLASS_PREFERENCES.filter(tag=>review.tags.includes(tag.id)).map(tag=><span key={tag.id}>{tag.label}</span>)}</div>
          {review.comments && <p className="review-comment">{review.comments}</p>}
        </article>)}
        {data.pages>1 && <nav className="catalog-pagination" aria-label="Review pages">
          {data.page>1 && <Link href={`${url}?page=${data.page-1}`}>← Newer reviews</Link>}<span>Page {data.page} of {data.pages}</span>
          {data.page<data.pages && <Link href={`${url}?page=${data.page+1}`}>Older reviews →</Link>}
        </nav>}
      </>}
    </section><section className="auth-card" aria-labelledby="add-review-title"><h2 id="add-review-title">Review this class</h2>
      {!profile ? <><p>Sign in and complete your profile to submit a review.</p><Link className="auth-button" href="/sign-in">Sign in to review</Link></>
        : data ? <ReviewForm code={course.code} professors={professors} /> : <p>Review submissions are temporarily unavailable. Please try again shortly.</p>}
    </section></div>
  </main>;
}
