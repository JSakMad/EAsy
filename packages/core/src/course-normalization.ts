import {PITT_SUBJECTS,PITT_SUBJECT_CODES,SUBJECT_TYPOS,SUBJECT_ABBREVIATIONS} from './subjects.js';

export const COURSE_NORMALIZATION_VERSION='pitt-subjects-v3';
export interface CourseResolution {code:string|null;method:string;reason:string;candidates:string[]}
export interface CourseContext {aliases?:Record<string,string>;knownCourses?:Iterable<string>;override?:string}
const clean=(s:string)=>s.normalize('NFKC').trim().toUpperCase().replace(/[._–—-]+/g,' ').replace(/\s+/g,' ');
const key=(s:string)=>clean(s).replace(/\s/g,'');
const subjectKey=(s:string)=>s.toUpperCase().replace(/[^A-Z]/g,'');
const parse=(s:string)=>clean(s).match(/^([A-Z][A-Z &/'()]*?)\s*(\d{1,4})([A-Z]?)$/);
const subjectExists=(s:string)=>Object.hasOwn(PITT_SUBJECTS,s);
function direct(raw:string):string|null {
  const m=parse(raw);
  if(!m) return null;
  const subject=subjectKey(m[1]!);
  return subjectExists(subject)?`${subject} ${m[2]!.padStart(4,'0')}${m[3]??''}`:null;
}
export function isCanonicalCourseCode(value:string):boolean {
  return /^[A-Z]+ \d{4}[A-Z]?$/.test(value)&&direct(value)===value;
}
export function trustedCourseCodes(rawLabels:Iterable<string>):Set<string> {
  const result=new Set<string>();
  for(const raw of rawLabels) {const code=direct(raw);if(code)result.add(code);}
  return result;
}
const names=new Map<string,string[]>();
for(const [code,name] of Object.entries(PITT_SUBJECTS)) {
  const k=subjectKey(name);names.set(k,[...(names.get(k)??[]),code]);
}
// Restricted one-edit spelling check (insertion/deletion/substitution/transposition).
function oneEdit(a:string,b:string):boolean {
  if(Math.abs(a.length-b.length)>1) return false;
  if(a.length===b.length) {
    const diffs=[...a].flatMap((c,i)=>c===b[i]?[]:[i]);
    if(diffs.length===1)return true;
    const [i,j]=diffs;
    return diffs.length===2&&j===i!+1&&a[i!]===b[j!]&&a[j!]===b[i!];
  }
  const [short,long]=a.length<b.length?[a,b]:[b,a];
  for(let i=0;i<long.length;i++) if(long.slice(0,i)+long.slice(i+1)===short)return true;
  return false;
}
export function resolveCourseCode(raw:string,context:CourseContext={}):CourseResolution {
  const ok=(code:string,method:string):CourseResolution=>({code,method,reason:'',candidates:[]});
  const unresolved=(reason:string,candidates:string[]=[]):CourseResolution=>({code:null,method:'quarantine',reason,candidates});
  if(context.override!==undefined) {
    const code=direct(context.override);
    return code?ok(code,'review_override'):unresolved('Configured review override is not a supported subject/course code');
  }
  const text=clean(raw);
  if(!text||text.length>150) return unresolved('Missing or excessively long course label');
  const known=new Set([...context.knownCourses??[]].filter(isCanonicalCourseCode));
  if(/^\d+$/.test(text)) {
    const candidates=text.length>=3&&text.length<=4?[...known].filter(c=>c.split(' ')[1]===text.padStart(4,'0')):[];
    return candidates.length===1?ok(candidates[0]!,'professor_number'):unresolved('Bare number does not identify one corroborated course for this professor',candidates);
  }
  const alias=Object.entries(context.aliases??{}).find(([label])=>key(label)===key(text));
  if(alias) {
    const code=direct(alias[1]);
    return code?ok(code,'course_alias'):unresolved('Configured course alias has an unsupported target');
  }
  const exact=direct(text);
  if(exact) return ok(exact,'canonical_subject');
  const match=parse(text);
  if(!match) return unresolved('Course label is missing a number or combines multiple courses');
  const subject=subjectKey(match[1]!);
  const number=match[2]!.padStart(4,'0')+(match[3]??'');
  const typo=SUBJECT_TYPOS[subject];
  if(typo) return ok(`${typo} ${number}`,'subject_typo');
  const named=[...new Set([...(names.get(subject)??[]),...(SUBJECT_ABBREVIATIONS[subject]??[])])];
  const candidates=named.length?named:subject.length>=4?PITT_SUBJECT_CODES.filter(c=>c.length>=4&&oneEdit(subject,c)):[];
  const choices=candidates.map(s=>`${s} ${number}`);
  const corroborated=choices.filter(c=>known.has(c));
  if(corroborated.length===1) return ok(corroborated[0]!,named.length?'professor_subject_alias':'professor_subject_typo');
  return unresolved(corroborated.length>1?'Multiple supported subjects match this professor and number':'Unrecognized subject/name lacks same-professor course corroboration',choices);
}
export function normalizeCourseCode(raw:string,aliases:Record<string,string>={}):string {
  return resolveCourseCode(raw,{aliases}).code??`UNMAPPED ${clean(raw)||'UNKNOWN'}`;
}
