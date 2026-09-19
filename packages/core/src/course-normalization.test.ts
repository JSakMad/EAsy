import {describe,it,expect} from 'vitest';
import aliases from '../../../config/course-aliases.json';
import {PITT_SUBJECT_CODES,normalizeCourseCode,resolveCourseCode,trustedCourseCodes,isCanonicalCourseCode} from './index.js';

describe('Pitt subject policy',()=>{
  it('retains all 216 subjects from the supplied list',()=>expect(PITT_SUBJECT_CODES).toHaveLength(216));
  it.each(PITT_SUBJECT_CODES)('accepts official subject %s without remapping it',subject=>{
    expect(normalizeCourseCode(`${subject}0042`,{})).toBe(`${subject} 0042`);
  });
  it.each([
    ['BUSMT1040','BUSMKT 1040'],['BSMKT1040','BUSMKT 1040'],['BUMKT1040','BUSMKT 1040'],['BUSMK1040','BUSMKT 1040'],
    ['NEUROSCI0080','NROSCI 0080'],['calc1','MATH 0220'],['CALCULUS 1','MATH 0220'],['CALCII','MATH 0230'],['CALC3','MATH 0240'],
    ['CS1530','CS 1530'],['NROSCI\u00a00080','NROSCI 0080'],
  ])('repairs %s to %s',(raw,code)=>expect(normalizeCourseCode(raw,aliases)).toBe(code));
  it.each(['CALC12','CALCULUS123','NEURO1','MKT1','MKTG001','MADEUP1234','CS15300','CALC20230','MATH','CALCULUS'])('does not invent a course for %s',raw=>{
    expect(resolveCourseCode(raw,{aliases,knownCourses:['MATH 0220','MATH 0240','NROSCI 0080','BUSMKT 1040']}).code).toBeNull();
  });
  it.each([
    ['MKT1040','BUSMKT 1040'],['MKTG1040','BUSMKT 1040'],['MARKETING1040','BUSMKT 1040'],
    ['MUS0311','MUSIC 0311'],['CALC220','MATH 0220'],['CALCULUS0220','MATH 0220'],
    ['NROCSI0080','NROSCI 0080'],['Computer Science 1530','CS 1530'],['0280','MATH 0280'],['230','MATH 0230'],
  ])('uses unique same-professor corroboration for %s',(raw,code)=>{
    expect(resolveCourseCode(raw,{knownCourses:[code]}).code).toBe(code);
    expect(resolveCourseCode(raw).code).toBeNull();
  });
  it('does not choose between valid subjects sharing the same label or number',()=>{
    expect(resolveCourseCode('Marketing1040',{knownCourses:['BUSMKT 1040','MRKT 1040']}).code).toBeNull();
    expect(resolveCourseCode('0080',{knownCourses:['NROSCI 0080','MATH 0080']}).code).toBeNull();
  });
  it('never remaps an already valid subject based on another professors/course context',()=>{
    expect(resolveCourseCode('BIOL10',{knownCourses:['BIOSC 0010']}).code).toBe('BIOL 0010');
    expect(resolveCourseCode('MRKT1040',{knownCourses:['BUSMKT 1040']}).code).toBe('MRKT 1040');
  });
  it('requires an official target for aliases and manual overrides',()=>{
    expect(resolveCourseCode('example',{aliases:{example:'FAKE 1234'}}).code).toBeNull();
    expect(resolveCourseCode('example',{override:'BUSMT 1040'}).code).toBeNull();
    expect(resolveCourseCode('example',{override:'BUSMKT 1040'}).code).toBe('BUSMKT 1040');
  });
  it('does not allow inferred labels to bootstrap other guesses',()=>{
    expect([...trustedCourseCodes(['MKT1040','BSMKT1040','MARKETING1040','BUSMKT1040'])]).toEqual(['BUSMKT 1040']);
  });
  it('checks canonical formatting as well as the subject',()=>{
    expect(isCanonicalCourseCode('BUSMT 1040')).toBe(false);
    expect(isCanonicalCourseCode('MATH 220')).toBe(false);
    expect(isCanonicalCourseCode('MATH 0220')).toBe(true);
  });
});
