"use client";

import {useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,ArrowUpRight,Search} from 'lucide-react';
import type {Course} from '@/lib/types';

const PAGE_SIZE = 4;

export function CourseNotebook({courses,page,onPageChange,onChoose,courseHref,demo=false,emptyTitle='This course does not exist in our course data',emptyDescription='Check the course code, name, professor, or field of study.'}:{courses:Course[];page:number;onPageChange:(page:number)=>void;onChoose?:(course:Course)=>void;courseHref?:(course:Course)=>string;demo?:boolean;emptyTitle?:string;emptyDescription?:string}) {
  const [direction,setDirection]=useState<'forward'|'backward'>('forward');
  const pages=Math.max(1,Math.ceil(courses.length/PAGE_SIZE));
  const current=Math.min(page,pages-1);
  const start=current*PAGE_SIZE;
  const entries=courses.slice(start,start+PAGE_SIZE);
  function turn(next:number) {
    if(next<0||next>=pages)return;
    setDirection(next>current?'forward':'backward');
    onPageChange(next);
  }

  return <section className="course-notebook" aria-label="Course notebook">
    <div className="notebook-binding" aria-hidden="true">{Array.from({length:8},(_,i)=><i key={i}/>)}</div>
    <button className="notebook-turn notebook-turn-prev" aria-label="Previous notebook page" aria-controls="notebook-courses" disabled={current===0} onClick={()=>turn(current-1)}><ArrowLeft size={18}/><span>Back</span></button>
    <div className="notebook-paper">
      <div className="notebook-caption"><span>Semester notes / course index</span><span aria-hidden="true">EAsy.</span></div>
      <div id="notebook-courses" className="notebook-sheet" key={`${current}-${courses.length}`} data-direction={direction}>
        {courses.length ? <div className="notebook-entries">{entries.map((course,i)=>{const content=<>
          <span className="notebook-entry-number" aria-hidden="true">{String(start+i+1).padStart(2,'0')}</span>
          <span className="notebook-course-copy"><strong>{course.courseCode}</strong><span>{course.courseTitle||'Course · student-reported data'}</span></span>
          <span className="notebook-course-meta"><span>{demo ? course.professorNames?.join(', ') : `${course.professorCount} professor${course.professorCount===1?'':'s'}`}</span><span>{demo ? `${course.professorCount} sample professor${course.professorCount===1?'':'s'}` : course.reviewCount ? `${course.reviewCount} reviews` : 'Be the first to review'}</span></span>
          <ArrowUpRight size={19} aria-hidden="true"/>
        </>;return courseHref ? <Link key={course.courseCode} href={courseHref(course)} className="notebook-course" aria-label={`Compare professors for ${course.courseCode}`}>{content}</Link> : <button key={course.courseCode} className="notebook-course" onClick={()=>onChoose?.(course)} aria-label={`Compare professors for ${course.courseCode}`}>{content}</button>;})}{Array.from({length:PAGE_SIZE-entries.length},(_,i)=><div className="notebook-blank" aria-hidden="true" key={`blank-${i}`}/>)}</div> : <div className="notebook-empty"><Search size={26}/><h3>{emptyTitle}</h3><p>{emptyDescription}</p></div>}
      </div>
      <div className="notebook-footer"><span className="notebook-handwriting">Your next chapter starts here.</span><span role="status" aria-live="polite" aria-atomic="true">{courses.length ? `Page ${current+1} of ${pages} · ${start+1}–${Math.min(start+PAGE_SIZE,courses.length)} of ${courses.length} course${courses.length===1?'':'s'}` : 'No courses found'}</span></div>
    </div>
    <button className="notebook-turn notebook-turn-next" aria-label="Next notebook page" aria-controls="notebook-courses" disabled={current===pages-1} onClick={()=>turn(current+1)}><span>Next</span><ArrowRight size={18}/></button>
    <p className="notebook-hint">{demo&&pages===1 ? 'One sample class. Room for a whole campus.' : 'Turn the page using the tabs on either side.'}</p>
  </section>;
}
