import {validateSummary,type Review,type Summary} from './policy.js';

// A conservative surface check, not a guarantee of grammatical completeness.
// Bullet items may legitimately be fragments; narrative paragraphs should not.
export function hasSentenceEnding(text:string):boolean {
  const value=text.trim();
  return /[.!?]["'”’\])]*$/u.test(value)&&!/(?:\.{2,}|…)["'”’\])]*$/u.test(value);
}
function completePrefix(text:string):string {
  const value=text.trim();
  if(hasSentenceEnding(value))return value;
  const sentences=[...new Intl.Segmenter('en',{granularity:'sentence'}).segment(value)];
  // Keep only a contiguous prefix of complete sentences. Do not guess how an
  // unfinished claim ends or append punctuation to make it appear complete.
  let end=0;
  for(const part of sentences) {
    if(!hasSentenceEnding(part.segment))break;
    end=part.index+part.segment.length;
  }
  const prefix=value.slice(0,end).trim();
  if(!prefix)throw new Error('Incomplete overview paragraph');
  return prefix;
}
export function validateCloudSummary(value:unknown,reviews:Review[],allowedIds:number[],cached=false):Summary {
  // Run privacy/schema checks on the original output, including any suffix that
  // might be dropped, so repair never bypasses those checks.
  const result=validateSummary(value,reviews,allowedIds);
  const summary=cached?completePrefix(result.summary):result.summary.trim();
  const changesOverTime=cached?completePrefix(result.changesOverTime):result.changesOverTime.trim();
  if(!hasSentenceEnding(summary)||!hasSentenceEnding(changesOverTime))throw new Error('Incomplete overview paragraph');
  return {...result,summary,changesOverTime};
}
