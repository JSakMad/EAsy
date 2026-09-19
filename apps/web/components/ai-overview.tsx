'use client';
import React,{useEffect,useState} from 'react';
import {Sparkles,CalendarDays,ShieldCheck,Clock3} from 'lucide-react';
import type {Overview} from '@/lib/types';
const date=(value:string)=>new Intl.DateTimeFormat('en-US',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value));
export function AiOverview({data:initial,demo,offeringId}:{data:Overview|null;demo:boolean;offeringId:string}) {
  const [data,setData]=useState(initial);
  const [busy,setBusy]=useState(false);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    setData(initial);setFailed(false);
    if(demo||initial?.status==='ready'||initial?.status==='insufficient')return;
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;let attempts=0;
    const generate=async()=>{
      if(controller.signal.aborted)return;
      setBusy(true);
      try {
        const response=await fetch(`${process.env.NEXT_PUBLIC_API_URL??'http://localhost:4000'}/offerings/${encodeURIComponent(offeringId)}/overview/generate`,{
          method:'POST',headers:{'Content-Type':'application/json'},body:'{}',cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(35000)]),
        });
        if(!response.ok)throw new Error('Unavailable');
        const result=(await response.json()).data as Overview;
        if(controller.signal.aborted)return;
        setData(result);
        if((result.reason==='busy'||result.reason==='cooldown')&&++attempts<3) {
          timer=setTimeout(generate,Math.min(65,Math.max(3,result.retryAfter??3))*1000);return;
        }
        setBusy(false);
      } catch {if(!controller.signal.aborted){setFailed(true);setBusy(false);}}
    };
    // Runs on a mounted detail page, not server rendering or link prefetch.
    timer=setTimeout(generate,100);
    return ()=>{controller.abort();clearTimeout(timer);};
  },[offeringId,demo,initial]);
  const ready=Boolean(data?.overview);
  const stats=data?.stats;
  return <section className="ai-overview" aria-labelledby="overview-title">
    <div className="overview-heading"><div><span className="overview-kicker"><Sparkles size={15}/> THE REVIEWS, IN CONTEXT</span><h2 id="overview-title">AI course overview</h2></div><span className="local-badge"><ShieldCheck size={14}/> Groq AI · cached monthly</span></div>
    <p className="overview-scope">For this professor teaching this course—not their other classes.</p>
    {stats&&<div className="overview-dates"><span><CalendarDays size={15}/>{stats.oldestReviewAt&&stats.newestReviewAt?`${date(stats.oldestReviewAt)} – ${date(stats.newestReviewAt)}`:'No reliable posting dates'}</span><span>{ready?`${stats.reviewCount} sampled of ${data?.totalReviews??stats.reviewCount} stored reviews`:`${data?.totalReviews??stats.reviewCount} stored reviews`}</span><span>{stats.reviewsInLast24Months} {ready?'sampled reviews ':''}posted in the last 24 months</span></div>}
    {data?.status==='stale'&&ready&&<p className="overview-warning">This saved summary is over 30 days old. {busy?'Refreshing it now.':'A refresh is temporarily unavailable; the original generation date remains below.'}</p>}
    {data?.sourceChanged&&<p className="overview-date-note">The database has changed since this summary. It describes the saved sample; updates are incorporated at the next monthly refresh.</p>}
    {busy&&<p role="status" className="overview-date-note">{ready?'Refreshing overview…':'Preparing your overview…'} This page updates automatically. Free-tier limits may briefly delay generation.</p>}
    {stats&&stats.reviewsInLast24Months===0&&<p className="overview-warning">No dated reviews from the past two years. Grading, exams, or workload may have changed.</p>}
    {stats&&(stats.undatedCount>0||stats.futureDatedCount>0)&&<p className="overview-date-note">{stats.undatedCount} undated and {stats.futureDatedCount} future-dated reviews are excluded from date-range and recency counts.</p>}
    {ready?<>
      <p className="overview-summary">{data!.overview!.summary}</p>
      <div className="overview-columns">
        <OverviewList title="What may help" items={data!.overview!.easierFactors}/>
        <OverviewList title="What takes effort" items={data!.overview!.harderFactors}/>
        <OverviewList title="How to prepare" items={data!.overview!.studyAdvice}/>
      </div>
      <div className="overview-trend"><Clock3 size={17}/><div><strong>Has the experience changed?</strong><p>{data!.overview!.changesOverTime}</p></div></div>
      <p className="overview-footnote">AI-generated from a size-limited sample prioritizing recent reviews and retaining differing difficulty reports. {Boolean(data?.truncatedCount)&&`${data!.truncatedCount} reviews were excerpted to fit the request budget. `}The dates above describe the sampled reviews, not the full database. May misinterpret evidence; verify current requirements in the syllabus. {data?.generatedAt&&`Generated ${date(data.generatedAt)}. `}Selected review text is processed by Groq; raw comments are not displayed here.</p>
    </>:<div className="overview-placeholder"><Sparkles size={21}/><div><strong>{demo?'AI overviews are for real imported reviews':data?.status==='insufficient'?'More review content needed':busy?'Summarizing this professor’s course':failed||data?.reason?'Overview temporarily unavailable':'Overview will load automatically'}</strong><p>{demo?'No fictional AI review summary is shown.':data?.status==='insufficient'?'At least three usable reviews are required for this specific pairing.':busy?'A small review sample is being summarized, then saved for 30 days.':data?.reason==='daily_limit'||data?.reason==='quota'?'The free API allowance is temporarily unavailable. Try again later; no paid fallback is used.':failed||data?.reason?'Generation could not complete right now. The course scores remain available; revisit later to retry.':'Opening this page requests a summary only if a current saved one is unavailable.'}</p></div></div>}
  </section>;
}
function OverviewList({title,items}:{title:string;items:string[]}) {
  return <div><h3>{title}</h3>{items.length?<ul>{items.map((item,i)=><li key={i}>{item}</li>)}</ul>:<p className="overview-date-note">Not enough consistent evidence to identify a theme.</p>}</div>;
}
