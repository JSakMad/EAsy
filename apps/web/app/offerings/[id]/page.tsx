import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, BarChart3, BookOpenCheck, Info, MessagesSquare } from "lucide-react";
import { getOffering, getOverview } from "@/lib/api";
import {AiOverview} from '@/components/ai-overview';
import { SiteHeader } from "@/components/site-header";
import { TAG_LABELS, CLASS_PREFERENCES, calculatePersonalScore } from '@easy-a/core';
import { getCatalogCourse } from '@/lib/catalog';
import { PersonalScoreNote } from '@/components/personal-score-note';
import { checkStudentSetup } from "@/lib/profile-access";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params; const { data } = await getOffering(id);
  if (!data) return { title: "Offering not found" };
  const title = `${data.courseCode} with ${data.professorName}`;
  const description = `EAsy score breakdown for ${data.courseCode} with ${data.professorName} at Pitt.`;
  return {
    title, description,
    openGraph: { title, description, images: [] },
    twitter: { card: "summary", title, description, images: [] },
  };
}

export default async function OfferingPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await checkStudentSetup();
  const { id } = await params;
  const [{data:offering,demo},overview]=await Promise.all([getOffering(id),getOverview(id)]);
  if (!offering) notFound();
  const catalogCourse = getCatalogCourse(offering.courseCode);
  const personal = profile&&!demo ? calculatePersonalScore(offering,profile.preferences??[]) : null;
  const displayScore = personal ? personal.score : offering.score;
  const scored = displayScore !== null;
  return <main><div className="shell"><SiteHeader /></div>
    <section className="detail-hero"><div className="shell">
      <Link href={`/?course=${encodeURIComponent(offering.courseCode)}`} className="back-link"><ArrowLeft size={16} /> Compare professors for {offering.courseCode}</Link>
      {demo && <div className="demo-banner detail-demo"><span>DEMO DATA</span> This fictional record is for product preview only.</div>}
      <div className="detail-title"><div><div className="eyebrow"><BookOpenCheck size={14} /> {offering.department}</div><h1>{offering.courseCode}</h1><p>{offering.courseTitle}</p><h2>{offering.professorName}</h2></div>
        <div className={`detail-score ${!scored ? "unscored" : ""}`}><span>{personal?"Your personal score":"EAsy score"}</span><strong>{scored ? Math.round(displayScore!) : "—"}</strong><small>{scored ? "out of 100" : "insufficient data"}</small></div>
      </div>
    </div></section>
    <section className="shell detail-body">
      {catalogCourse && <div className="personal-ranking-note"><Link href={`/catalog/${encodeURIComponent(catalogCourse.code)}`}>Read EAsy student reviews or review this class →</Link>
        {Boolean(offering.studentReviewCount) && <p>This score combines {offering.studentReviewCount} EAsy student reviews and {offering.importedReviewCount ?? 0} imported reviews. AI overviews summarize imported reviews only.</p>}
      </div>}
      <AiOverview data={overview} demo={demo} offeringId={id}/>
      <div className="breakdown-panel"><div className="panel-heading"><div><p>Why this score</p><h2>The full breakdown</h2></div><BarChart3 size={24} /></div>
        <ComponentBar label="Reported A or A−" value={offering.gradeAPct ?? 0} points={offering.gradeComponent} max={50} color="gold" note={`${offering.gradeResponseCount} grade reports`} />
        <ComponentBar label="Lower difficulty" value={offering.avgDifficulty ? ((5-offering.avgDifficulty)/4)*100 : 0} points={offering.difficultyComponent} max={35} color="blue" note={offering.avgDifficulty ? `${Number(offering.avgDifficulty).toFixed(1)} / 5 average difficulty` : "No difficulty data"} />
        <ComponentBar label="Class structure" value={offering.tagBonus*100} points={offering.tagComponent} max={15} color="green" note={`${offering.tags.length} distinct ease signals`} />
        {personal&&<><PersonalScoreNote offering={offering} preferences={profile!.preferences??[]} detailed/><p className="personal-score-note"><Link href="/account/setup">Edit your preferences</Link></p></>}
      </div>
      <aside className="detail-aside">
        <div className="evidence-card"><MessagesSquare size={22} /><strong>{offering.reviewCount} student reviews</strong><p>{offering.reviewCount >= 25 ? "This score has a stronger sample than most." : "This is a limited sample. Use the score with extra caution."}</p></div>
        <div className="tag-card"><p>What students reported</p><div>{offering.tags.map((tag) => <span key={tag}>{TAG_LABELS[tag]}</span>)}</div></div>
        {CLASS_PREFERENCES.some(tag=>tag.tags.length!==1&&(offering.preferenceEvidence?.[tag.id]??0)>0) && <div className="tag-card"><p>Also reported by EAsy students</p><div>{CLASS_PREFERENCES.filter(tag=>tag.tags.length!==1&&(offering.preferenceEvidence?.[tag.id]??0)>0).map(tag=><span key={tag.id}>{tag.label}</span>)}</div></div>}
        {offering.rmpUrl && <a href={offering.rmpUrl} target="_blank" rel="noreferrer" className="rmp-link">View original source on RMP <ArrowUpRight size={17} /></a>}
      </aside>
      <div className="method-note"><Info size={19} /><p><strong>Methodology v1</strong> combines self-reported A/A− outcomes (50%), inverted difficulty (35%), and distinct class-structure signals (15%). Missing grades are excluded from the grade denominator. The weights will evolve as the dataset grows. {personal&&<> Your personal score adds up to 30% of the remaining distance to 100 for supported preferences. Each preference reaches full evidence weight at three review mentions. Online-class matches require explicit student reports. This is a preference ranking, not a predicted grade.</>}</p></div>
    </section>
  </main>;
}

function ComponentBar({ label,value,points,max,color,note }:{ label:string;value:number;points:number;max:number;color:string;note:string }) {
  return <div className="component-row"><div className="component-label"><strong>{label}</strong><span>{note}</span></div><div className="bar-track"><i className={color} style={{width:`${Math.max(0,Math.min(100,value))}%`}} /></div><div className="component-points"><strong>{Number(points).toFixed(1)}</strong><span>/ {max} pts</span></div></div>;
}
