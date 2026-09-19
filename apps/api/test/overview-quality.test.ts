import {describe,it,expect} from 'vitest';
import {validateCloudSummary,hasSentenceEnding} from '../src/overview/output-quality.js';
import type {Summary} from '../src/overview/policy.js';
const summary:Summary={summary:'Some students found the exams manageable. Others needed additional preparation.',changesOverTime:'No clear time trend is established.',easierFactors:['Optional practice materials'],harderFactors:[],studyAdvice:[],evidenceIds:[1]};
describe('complete overview paragraphs',()=>{
  it('preserves complete paragraphs and unpunctuated bullet items',()=>{
    expect(validateCloudSummary(summary,[],[1])).toEqual(summary);
  });
  it.each(['The textbook was less ','Students reported...','Students reported…','Workload varies;'])('rejects incomplete new output: %s',text=>{
    expect(()=>validateCloudSummary({...summary,summary:text},[],[1])).toThrow('Incomplete');
  });
  it('rejects a dangling final sentence even after complete sentences',()=>{
    expect(()=>validateCloudSummary({...summary,summary:summary.summary+' The textbook was less '},[],[1])).toThrow('Incomplete');
  });
  it('keeps only the complete prefix of an old cached overview without inventing an ending',()=>{
    const input={...summary,summary:summary.summary+' The textbook was less '};
    expect(validateCloudSummary(input,[],[1],true)).toEqual(summary);
    expect(input.summary).toContain('less ');
  });
  it('does not turn an entirely incomplete cached paragraph into a claim',()=>{
    expect(()=>validateCloudSummary({...summary,summary:'The textbook was less '},[],[1],true)).toThrow('Incomplete');
  });
  it('checks the time-trend paragraph too',()=>{
    expect(()=>validateCloudSummary({...summary,changesOverTime:'Newer reviews suggest'},[],[1])).toThrow('Incomplete');
    expect(validateCloudSummary({...summary,changesOverTime:'No clear trend is established. Newer reviews suggest'},[],[1],true).changesOverTime).toBe('No clear trend is established.');
  });
  it('accepts closing quotation marks, question marks, and whitespace',()=>{
    for(const text of ['Reports vary.  ','Is the evidence consistent?','One report says “prepare carefully.”'])expect(hasSentenceEnding(text)).toBe(true);
  });
  it('does not bypass privacy validation when removing a cached suffix',()=>{
    expect(()=>validateCloudSummary({...summary,summary:summary.summary+' Contact a@example.com for'},[],[1],true)).toThrow('Unsafe');
  });
});
