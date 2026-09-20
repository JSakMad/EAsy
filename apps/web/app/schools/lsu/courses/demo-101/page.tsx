import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { lsuDemo as course } from '@/lib/lsu-demo';

export const metadata = { title: 'DEMO 101 with Dr. Avery Rowan' };

export default function LsuCoursePage() {
  return <main><div className="shell"><SiteHeader school="lsu"/></div>
    <section className="detail-hero"><div className="shell"><Link className="back-link" href="/schools/lsu#lsu-courses">← LSU sample courses</Link>
      <div className="detail-title"><div><p className="section-kicker">Fictional course / {course.field}</p><h1>{course.code}</h1><p>{course.title}</p><h2>{course.professor}</h2></div><div className="detail-score"><span>Sample score</span><strong>{course.score}</strong><small>out of 100 · fictional</small></div></div>
    </div></section>
    <div className="shell lsu-detail-body"><p className="personal-ranking-note">Proof of concept: this course, professor, and all figures below are invented. They are not actual LSU student reports.</p>
      <section className="ai-overview"><p className="section-kicker">Illustrative overview</p><h2>A look inside the sample class.</h2><p className="overview-summary">This example imagines a class built around short weekly exercises and a collaborative final project. Students practice approaching open-ended problems and explaining their reasoning.</p><p className="overview-footnote">Written as demo content; not generated from real reviews.</p></section>
      <section className="lsu-sample-stats" aria-label="Fictional class statistics"><div><strong>{course.difficulty}/5</strong><span>Sample difficulty</span></div><div><strong>{course.aPercent}%</strong><span>Sample A/A− reports</span></div><div><strong>{course.reviews}</strong><span>Simulated reviews</span></div></section>
      <p className="coverage-note">Review submissions are unavailable in this demonstration.</p><Link className="auth-back" href="/schools/lsu">Back to the LSU demo</Link>
    </div><footer className="shell"><p>EAsy / LSU proof of concept</p><p>Fictional data. Not affiliated with Louisiana State University.</p></footer>
  </main>;
}
