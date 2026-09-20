'use client';

import { useState } from 'react';
import { ArrowUpRight, Search } from 'lucide-react';
import { SiteHeader } from './site-header';
import { lsuDemo } from '@/lib/lsu-demo';
import { CourseNotebook } from './course-notebook';

const sampleCourses=[{courseCode:lsuDemo.code,courseTitle:lsuDemo.title,professorCount:1,reviewCount:lsuDemo.reviews,professorNames:[lsuDemo.professor]}];

export function LsuExperience() {
  const [query, setQuery] = useState('');
  const [page,setPage]=useState(0);
  const compact = (value: string) => value.toLowerCase().replace(/\s+/g, '');
  const matches = compact(`${lsuDemo.code} ${lsuDemo.title} ${lsuDemo.professor} ${lsuDemo.field}`).includes(compact(query));
  return <main>
    <div className="shell"><SiteHeader school="lsu" /></div>
    <section className="hero easy-hero"><div className="shell hero-grid">
      <div className="hero-copy"><p className="eyebrow">Louisiana State University / demo edition</p><h1>A new campus.<br/><em>The same idea.</em></h1><p>A little clarity before registration. Explore a sample class and professor to see how EAsy could work at LSU.</p><a href="#lsu-courses" className="hero-cta">Explore the sample class <ArrowUpRight size={18}/></a></div>
      <aside className="field-notes"><div className="note-caption"><span>Campus notes</span><span>LSU</span></div><h2>One class. A proof of concept.</h2><p>This is a separate demonstration. The course, professor, scores, and review counts are fictional.</p><p className="note-foot">No LSU reviews are collected here. Switch back to Pitt for the live course guide.</p><span className="note-scribble">Room for another campus.</span></aside>
    </div></section>
    <section id="lsu-courses" className="shell course-finder"><label className="course-search"><span>Search the LSU demo</span><div><Search size={20}/><input value={query} onChange={event => {setQuery(event.target.value);setPage(0);}} aria-label="Search LSU courses or professors" placeholder="Try DEMO 101 or Avery Rowan"/></div></label>
      <div className="catalog-heading"><div><p className="section-kicker">The sample course index</p><h2>Start with a class.</h2></div><span>{matches ? '1 sample course' : '0 sample courses'}</span></div>
      <p className="coverage-note">Fictional data for demonstration, not an LSU course listing or professor recommendation.</p>
      <CourseNotebook courses={matches?sampleCourses:[]} page={page} onPageChange={setPage} courseHref={()=>lsuDemo.href} demo emptyTitle="This course does not exist in the LSU demo" emptyDescription="Try DEMO 101, the class name, or Avery Rowan. Only one sample class is available."/>
    </section><footer className="shell"><p>EAsy / LSU proof of concept</p><p>Fictional data. Not affiliated with Louisiana State University.</p></footer>
  </main>;
}
