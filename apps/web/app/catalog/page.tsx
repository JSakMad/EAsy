import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { CATALOG_COURSES, CATALOG_FIELDS, searchCatalog } from '@/lib/catalog';
import { checkStudentSetup } from '@/lib/profile-access';

export const metadata: Metadata = { title: 'Course catalog', description: 'Search Pitt courses by code, title, or field of study and share your class experience.' };
export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ q?: string; field?: string; page?: string }> }) {
  await checkStudentSetup();
  const params = await searchParams;
  const q = (typeof params.q === 'string' ? params.q : '').slice(0,100);
  const field = typeof params.field === 'string' && CATALOG_FIELDS.includes(params.field) ? params.field : '';
  const result = searchCatalog(q,field,Number(params.page ?? 1));
  const href = (page: number) => '/catalog?'+new URLSearchParams({ q, field, page: String(page) });
  return <main className="shell catalog-main"><SiteHeader />
    <section className="catalog-intro"><p className="section-kicker">The full course catalog</p><h1>Find your class. Share what it was like.</h1>
      <p>Search {CATALOG_COURSES.length.toLocaleString('en-US')} courses by code, title, or field of study. Every course can receive a review, even if no one has reviewed it yet.</p>
    </section>
    <form action="/catalog" className="catalog-search" role="search">
      <div><label htmlFor="catalog-query">Course code, title, or subject</label><input id="catalog-query" name="q" defaultValue={q} maxLength={100} placeholder="Try CS0447, biology, or accounting" type="search" /></div>
      <div><label htmlFor="catalog-field">Field of study</label><select id="catalog-field" name="field" defaultValue={field}><option value="">All fields</option>{CATALOG_FIELDS.map(value => <option key={value}>{value}</option>)}</select></div>
      <button className="auth-button" type="submit">Search courses</button>
    </form>
    <div className="catalog-result-heading"><h2>{result.total.toLocaleString('en-US')} matching courses</h2><Link href="/">Compare reviewed professors</Link></div>
    {result.total===0 ? <p className="catalog-empty">No courses match. Try a shorter title, a course code without spaces, or All fields.</p> :
      <div className="catalog-grid">{result.courses.map(course => <Link href={`/catalog/${encodeURIComponent(course.code)}`} className="catalog-card" key={course.code}>
        <h3>{course.code}</h3><p>{course.title}</p><div className="catalog-fields">{course.fieldsOfStudy.map(tag => <span key={tag}>{tag}</span>)}</div><strong>Read or add a review →</strong>
      </Link>)}</div>}
    <nav className="catalog-pagination" aria-label="Catalog pages">
      {result.page>1 && <Link href={href(result.page-1)}>← Previous</Link>}
      <span>Page {result.page} of {result.pages}</span>
      {result.page<result.pages && <Link href={href(result.page+1)}>Next →</Link>}
    </nav>
  </main>;
}
