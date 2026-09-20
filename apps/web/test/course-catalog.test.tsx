import React from 'react';
import {afterEach,describe,it,expect} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {PITT_SUBJECT_CODES} from '@easy-a/core';
import {BrowseExperience} from '../components/browse-experience';
import {SubjectIcon,SUBJECT_ICONS,SUBJECT_ICON_GROUPS} from '../components/subject-icon';
import type {Course} from '../lib/types';
afterEach(cleanup);
const courses:Course[]=[
  {courseCode:'ENGCMP 0200',courseTitle:null,reviewCount:3,professorCount:3},
  {courseCode:'MATH 0230',courseTitle:null,reviewCount:120,professorCount:2},
  {courseCode:'CS 1530',courseTitle:null,reviewCount:50,professorCount:1},
  {courseCode:'MATH 0220',courseTitle:null,reviewCount:50,professorCount:9},
];
const cardNames=()=>screen.getAllByRole('button',{name:/Compare professors for/}).map(el=>el.getAttribute('aria-label')?.replace('Compare professors for ',''));
describe('course catalog ordering',()=>{
  it('sorts total reviews descending, with course-code ties, without mutating props',()=>{
    const original=JSON.stringify(courses);
    render(<BrowseExperience courses={courses} demo={false}/>);
    expect(cardNames()).toEqual(['MATH 0230','CS 1530','MATH 0220','ENGCMP 0200']);
    expect(JSON.stringify(courses)).toBe(original);
  });
  it('keeps review ordering when searching or filtering by subject',()=>{
    render(<BrowseExperience courses={courses} demo={false}/>);
    fireEvent.change(screen.getByRole('textbox',{name:'Search by course code, name, or professor'}),{target:{value:'MATH'}});
    expect(cardNames()).toEqual(['MATH 0230','MATH 0220']);
    fireEvent.change(screen.getByRole('textbox'),{target:{value:''}});
    fireEvent.change(screen.getByRole('combobox'),{target:{value:'MATH'}});
    expect(cardNames()).toEqual(['MATH 0230','MATH 0220']);
  });
  it('sorts before limiting the initial 24 cards and preserves order on show more',()=>{
    const many=Array.from({length:30},(_,i)=>({courseCode:`MATH ${String(i).padStart(4,'0')}`,courseTitle:null,reviewCount:i,professorCount:1}));
    render(<BrowseExperience courses={many} demo/>);
    expect(cardNames()).toHaveLength(24);expect(cardNames()[0]).toBe('MATH 0029');
    fireEvent.click(screen.getByRole('button',{name:/Show more courses/}));
    expect(cardNames()).toHaveLength(30);expect(cardNames().at(-1)).toBe('MATH 0000');
  });
});
describe('subject icons',()=>{
  it('explicitly covers every official subject once, with no misspelled codes',()=>{
    const codes=SUBJECT_ICON_GROUPS.flatMap(g=>g.codes.split(' '));
    expect(codes.sort()).toEqual([...PITT_SUBJECT_CODES].sort());
    expect(new Set(codes).size).toBe(codes.length);
  });
  it.each([['MATH 0230','lucide-plus'],['ENGCMP0200','lucide-book-open'],['CS 1530','lucide-code-xml'],['CHEM 0110','lucide-flask-conical'],['NROSCI 0080','lucide-brain']])('uses an appropriate symbol for %s', (code,icon)=>{
    const {container}=render(<SubjectIcon courseCode={code}/>);
    expect(container.querySelector(`svg.${icon}`)).not.toBeNull();
  });
  it('uses a safe fallback for new, unknown subject codes',()=>{
    const {container}=render(<SubjectIcon courseCode="NEW 1234"/>);
    expect(container.querySelector('svg.lucide-graduation-cap')).not.toBeNull();
    expect(Object.keys(SUBJECT_ICONS)).toHaveLength(216);
  });
});
