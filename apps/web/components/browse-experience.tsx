"use client";

import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,ArrowUpRight,Search,SlidersHorizontal,Users} from 'lucide-react';
import {TAG_LABELS,TAG_GROUPS,normalizeCourseCode,type TagType} from '@easy-a/core';
import type {Course,Offering} from '@/lib/types';
import {demoOfferings} from '@/lib/demo-data';
import {SiteHeader} from './site-header';
import {SubjectIcon} from './subject-icon';
import {calculatePersonalScore, type ClassPreference} from '@easy-a/core';
import {PersonalScoreNote} from './personal-score-note';

type SortKey='score'|'reviews'|'difficulty';
const compact=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/\s+/g,'');

export function BrowseExperience({courses,demo,initialCode,preferences=null}:{courses:Course[];demo:boolean;initialCode?:string;preferences?:ClassPreference[]|null}) {
  const personalized=preferences!==null&&!demo;
  const [selected,setSelected]=useState<Course|null>(()=>courses.find(c=>c.courseCode===normalizeCourseCode(initialCode??'',{})||compact(c.courseCode)===compact(initialCode??''))??null);
  const [query,setQuery]=useState('');
  const [subject,setSubject]=useState('all');
  const [limit,setLimit]=useState(24);
  const [offerings,setOfferings]=useState<Offering[]>([]);
  const [tags,setTags]=useState<TagType[]>([]);
  const [sort,setSort]=useState<SortKey>('score');
  const [loading,setLoading]=useState(Boolean(selected));
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  const resultsHeading=useRef<HTMLHeadingElement>(null);
  const searchInput=useRef<HTMLInputElement>(null);
  const subjects=useMemo(()=>[...new Set(courses.map(c=>c.courseCode.split(' ')[0]))].sort(),[courses]);
  const matches=useMemo(()=>courses.filter(c=>(subject==='all'||c.courseCode.split(' ')[0]===subject)&&
    (!query.trim()||compact(c.courseCode).includes(compact(query))||c.courseCode===normalizeCourseCode(query,{})||[c.courseTitle,...(c.professorNames??[]),...(c.fieldsOfStudy??[]),...(c.alternateTitles??[])].filter(Boolean).join(' ').toLowerCase().includes(query.trim().toLowerCase())))
    .sort((a,b)=>b.reviewCount-a.reviewCount||a.courseCode.localeCompare(b.courseCode)),[courses,query,subject]);

  useEffect(()=>{
    if(!selected) return;
    const controller=new AbortController();
    setLoading(true);setError('');setOfferings([]);
    async function fetchCourse() {
      try {
        let data:Offering[];
        if(demo) data=demoOfferings.filter(o=>o.courseCode===selected!.courseCode);
        else {
          const response=await fetch(`/api/courses/${encodeURIComponent(selected!.courseCode)}/offerings`,{signal:controller.signal,cache:'no-store'});
          if(!response.ok) throw new Error('Course comparison unavailable.');
          data=(await response.json()).data;
        }
        if(!controller.signal.aborted) setOfferings(data);
      } catch {
        if(!controller.signal.aborted) setError('We could not load this course. Check the API connection and try again.');
      } finally {if(!controller.signal.aborted) setLoading(false);}
    }
    void fetchCourse();
    return ()=>controller.abort();
  },[selected,demo,retry]);

  function choose(course:Course) {
    setOfferings([]);setLoading(true);setTags([]);setSort('score');setSelected(course);
    window.history.replaceState(null,'',`/?course=${encodeURIComponent(course.courseCode)}`);
    requestAnimationFrame(()=>resultsHeading.current?.focus());
  }
  function back() {
    setSelected(null);setOfferings([]);setError('');setLoading(false);setTags([]);
    window.history.replaceState(null,'','/');
    requestAnimationFrame(()=>searchInput.current?.focus());
  }
  const ranked=useMemo(()=>offerings.map(o=>({...o,displayScore:personalized?calculatePersonalScore(o,preferences??[]).score:o.score})),[offerings,preferences,personalized]);
  const visible=useMemo(()=>ranked.filter(o=>tags.every(t=>o.tags.includes(t))).sort((a,b)=>{
    const result=sort==='reviews'?b.reviewCount-a.reviewCount:sort==='difficulty'?(a.avgDifficulty??99)-(b.avgDifficulty??99):(b.displayScore??-1)-(a.displayScore??-1);
    return result||b.reviewCount-a.reviewCount||a.professorName.localeCompare(b.professorName);
  }),[ranked,tags,sort]);

  return <main>
    <div className="shell"><SiteHeader/></div>
    {!selected&&<section className="hero easy-hero">
      <div className="shell hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">Notes for your next semester</p>
          <h1>A little homework.<br/><em>A better fit.</em></h1>
          <p>Same class. Different experiences. Find your course and get to know the professors before you pick one.</p>
          <a className="hero-cta" href="#course-finder">Find your course <ArrowRight size={18}/></a>
          <span className="hand-note">Start here. Your future self will thank you.</span>
        </div>
        <aside className="field-notes" aria-label="How scores work">
          <div className="note-caption"><span>EAsy field notes</span><span>No. 01</span></div>
          <h2>{personalized?'Good on paper. Better for you.':'Look beyond the course code.'}</h2>
          <dl><div><dt>01 / Grades</dt><dd>What students actually earned.</dd></div><div><dt>02 / Difficulty</dt><dd>How much work to expect.</dd></div><div><dt>03 / Class style</dt><dd>{personalized?'The details that match your preferences.':'Quizzes, exams, and the everyday details.'}</dd></div></dl>
          <p className="note-foot">{personalized?<Link href="/account/setup">Your preferences are part of the picture. Edit them here.</Link>:'Student reports, not promises. Five reviews are needed for a score.'}</p>
          <span className="note-scribble" aria-hidden="true">Find your kind of class.</span>
        </aside>
      </div>
    </section>}

    <section id="course-finder" className="finder shell course-finder">
      {demo&&<div className="demo-banner"><span>DEMO DATA</span> The API is unavailable. These fictional examples are not real professor recommendations.</div>}
      {!selected?<>
        <div className="finder-toolbar course-toolbar">
          <label className="course-search"><span>Search the index</span><div><Search size={21}/><input ref={searchInput} value={query} onChange={e=>{setQuery(e.target.value);setLimit(24);}} placeholder="Course code, course name, or professor" aria-label="Search by course code, name, or professor"/></div></label>
          <label className="subject-picker"><span>Subject</span><select value={subject} onChange={e=>{setSubject(e.target.value);setLimit(24);}}><option value="all">All subjects</option>{subjects.map(s=><option key={s}>{s}</option>)}</select></label>
        </div>
        <div className="catalog-heading"><div><p className="section-kicker">The course index</p><h2>What’s on your schedule?</h2></div><span aria-live="polite">{matches.length} courses</span></div>
        <p className="coverage-note">Search all supplied courses by code, name, professor, or field of study. Most-reviewed courses appear first.</p>
        <div className="course-grid">{matches.slice(0,limit).map(course=><button key={course.courseCode} className="course-card" onClick={()=>choose(course)} aria-label={`Compare professors for ${course.courseCode}`}>
          <div className="course-card-top"><SubjectIcon courseCode={course.courseCode}/><ArrowUpRight size={19}/></div>
          <h3>{course.courseCode}</h3><p>{course.courseTitle||'Pitt course · student-reported data'}</p>
          <div className="course-card-bottom"><span><Users size={14}/>{course.professorCount} professor{course.professorCount===1?'':'s'}</span><span>{course.reviewCount} reviews</span></div>
        </button>)}</div>
        {matches.length>limit&&<button className="load-more" onClick={()=>setLimit(n=>n+24)}>Show more courses <ArrowRight size={16}/></button>}
        {matches.length===0&&<div className="empty-state"><Search size={28}/><h3>This course does not exist in our course data</h3><p>Check the course code, name, or professor, or choose All subjects.</p></div>}
      </>:<>
        <div className="comparison-top"><button onClick={back} className="back-button"><ArrowLeft size={16}/> All courses</button><span>Same course. Different professors.</span></div>
        <div className="content-grid comparison-grid">
          <aside className="filters"><div className="filter-heading"><span><SlidersHorizontal size={17}/> Class details</span>{tags.length>0&&<button onClick={()=>setTags([])}>Clear all</button>}</div><p>Match all selected tags. These are student reports, not verified policies.</p>
            <div className="filter-groups">{TAG_GROUPS.map(group=><details key={group.label} open={group.label==='Exam format'}><summary>{group.label}<span>{group.tags.filter(t=>tags.includes(t)).length||''}</span></summary><div className="check-list">{group.tags.map(tag=><label key={tag} className={tags.includes(tag)?'checked':''}><input type="checkbox" checked={tags.includes(tag)} onChange={()=>setTags(old=>old.includes(tag)?old.filter(t=>t!==tag):[...old,tag])}/><span className="fake-check">✓</span><span>{TAG_LABELS[tag]}</span></label>)}</div></details>)}</div>
          </aside>
          <div className="results" aria-busy={loading}>
            <div className="results-head"><div><p>Compare professors for</p><h2 ref={resultsHeading} tabIndex={-1}>{selected.courseCode}</h2></div><label className="sort-field">Sort by <select aria-label="Sort professors" value={sort} onChange={e=>setSort(e.target.value as SortKey)}><option value="score">{personalized?"Highest personal score":"Highest EAsy score"}</option><option value="difficulty">Lowest difficulty</option><option value="reviews">Most reviews</option></select></label></div>
            {selected.courseTitle&&<p>{selected.courseTitle}</p>}
            {!demo&&<p><Link href={`/catalog/${encodeURIComponent(selected.courseCode)}`}>Leave a review for this course</Link></p>}
            <p className="coverage-note">Historical professor/course comparisons—not confirmed current sections. A higher score suggests easier reported outcomes, not a guaranteed A.</p>
            {personalized&&<div className="personal-ranking-note">Scores reflect your saved class preferences. <Link href="/account/setup">Edit preferences</Link>. A matching feature boosts a score when reviews support it; an unreported feature stays unknown.</div>}
            <div className="active-tags">{tags.map(t=><button key={t} onClick={()=>setTags(old=>old.filter(tag=>tag!==t))}>{TAG_LABELS[t]} ×</button>)}</div>
            <p className="comparison-count" role="status">{loading?'Loading professors…':error?'Comparison unavailable':`${visible.length} professor${visible.length===1?'':'s'}${tags.length?' matching your filters':''}`}</p>
            {error?<div className="empty-state" role="alert"><p>{error}</p><button className="load-more" onClick={()=>setRetry(n=>n+1)}>Try again</button></div>:<div className="offering-list">{!loading&&visible.map((o,i)=><OfferingCard key={o.id} offering={o} rank={i+1} preferences={personalized?preferences:null}/>)}
              {!loading&&visible.length===0&&<div className="empty-state"><Search size={26}/><h3>{tags.length?'No professors match these filters':'No reviews yet for this course'}</h3><p>{tags.length?'Remove a filter to see more professors for this course.':'Have you taken this class? Be the first to share your experience and help other students choose.'}</p>{!tags.length&&!demo&&<Link className="auth-button" href={`/catalog/${encodeURIComponent(selected.courseCode)}`}>Leave the first review</Link>}</div>}
            </div>}
          </div>
        </div>
      </>}
    </section>
    <footer className="shell"><p>EAsy. Made for the next semester.</p><p>Not affiliated with Pitt or Rate My Professors.</p></footer>
  </main>;
}

export function OfferingCard({offering:o,rank,preferences=null}:{offering:Offering;rank:number;preferences?:ClassPreference[]|null}) {
  const score=preferences===null?o.score:calculatePersonalScore(o,preferences).score;
  const scored=score!==null;
  return <article className={`offering-card ${scored?'':'unscored'}`}>
    <div className="rank">{String(rank).padStart(2,'0')}</div>
    <div className={`score-orb ${scored&&score!>=80?'high':scored&&score!>=70?'mid':'low'}`}><strong>{scored?Math.round(score!):'—'}</strong><span>{scored?(preferences===null?'EAsy / 100':'FOR YOU / 100'):'UNSCORED'}</span></div>
    <div className="offering-main"><div className="course-line"><span>{o.courseCode}</span><i/><span>{o.department}</span></div><h3>{o.professorName}</h3><div className="tags-row">{o.tags.slice(0,4).map(t=><span key={t}>{TAG_LABELS[t]}</span>)}</div><p className="professor-metrics">{o.avgDifficulty===null?'No difficulty data':`${Number(o.avgDifficulty).toFixed(1)}/5 difficulty`} · {o.gradeAPct===null?'No grade reports':`${Math.round(o.gradeAPct)}% reported A grades`}</p>{preferences!==null&&<PersonalScoreNote offering={o} preferences={preferences}/>}</div>
    <div className="sample"><strong>{o.reviewCount}</strong><span>reviews</span><small className={o.reviewCount>=25?'strong':'limited'}>{o.reviewCount>=25?'larger sample':'limited sample'}</small></div>
    <Link className="details-link" href={`/offerings/${o.id}`} aria-label={`View ${o.courseCode} with ${o.professorName}`}><ArrowUpRight size={20}/></Link>
    {!scored&&<div className="insufficient">Needs at least 5 reviews to receive a score</div>}
  </article>;
}
