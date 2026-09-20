// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { syllabusAiBody, validateSyllabusAi, verifySyllabusWithGroq, syllabusClaims } from '../lib/syllabus-ai';
vi.mock('server-only',()=>({}));

const target={courseCode:'CS 0447',courseTitle:'Computer Organization and Assembly Language',professorName:'Jarrett Billingsley',tags:['online_quizzes','optional_attendance'] as ('online_quizzes'|'optional_attendance')[]};
const text='CS 0447: Computer Organization and Assembly Language\nProfessor: Jarrett Billingsley\nWeekly quizzes are delivered through Canvas and may be completed from home.\nAttendance is optional.';
function output(){return {course:{verdict:'supported',evidence:['CS 0447: Computer Organization and Assembly Language']},professor:{verdict:'supported',evidence:['Professor: Jarrett Billingsley']},findings:syllabusClaims(target).map(claim=>({id:claim.id,verdict:'supported',evidence:[claim.id.includes('attendance')?'Attendance is optional.':'Weekly quizzes are delivered through Canvas and may be completed from home.']}))};}

describe('grounded Groq syllabus checks',()=>{
  it('accepts semantic policy evidence and only requested claims',()=>{
    expect(validateSyllabusAi(output(),text,target)).toEqual({preferences:['online_quizzes','optional_attendance'],tags:['online_quizzes','attendance_not_required']});
  });
  it('does not verify contradicted or unknown policies',()=>{
    const result=output();result.findings=result.findings.map(f=>({...f,verdict:'unknown',evidence:[]}));
    expect(validateSyllabusAi(result,text,target)).toEqual({preferences:[],tags:[]});
  });
  it('rejects identity mismatches and invented, missing, duplicated or extra evidence',()=>{
    const mismatch=output();mismatch.professor.verdict='contradicted';expect(()=>validateSyllabusAi(mismatch,text,target)).toThrow('different syllabus');
    const fake=output();fake.findings[0]!.evidence=['The professor makes all quizzes available online.'];expect(()=>validateSyllabusAi(fake,text,target)).toThrow('unsupported');
    const missing=output();missing.findings.pop();expect(()=>validateSyllabusAi(missing,text,target)).toThrow();
    const duplicate=output();duplicate.findings[1]=duplicate.findings[0]!;expect(()=>validateSyllabusAi(duplicate,text,target)).toThrow();
    const other=output();other.findings[0]!.id='preference:online_classes';expect(()=>validateSyllabusAi(other,text,target)).toThrow();
    const wrongCode=output();wrongCode.course.evidence=['Attendance is optional.'];expect(()=>validateSyllabusAi(wrongCode,text,target)).toThrow();
  });
  it('redacts contact details, sends the whole document, and bounds size',()=>{
    const result=syllabusAiBody(text+'\nEmail: instructor@example.com\nhttps://example.com\n412-555-1234',target);
    expect(JSON.stringify(result.body)).not.toContain('instructor@example.com');
    expect(result.document).not.toContain('412-555-1234');
    expect(result.document).toContain('Attendance is optional.');
    expect(()=>syllabusAiBody('x'.repeat(48001),target)).toThrow('never silently truncated');
  });
  it('calls Groq with a server key and checks completion status',async()=>{
    const fetcher=vi.fn().mockResolvedValue(Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(output())}}]}));
    expect((await verifySyllabusWithGroq(text,target,'test-key',fetcher)).preferences).toHaveLength(2);
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(fetcher.mock.calls[0]?.[1].headers.Authorization).toBe('Bearer test-key');
    fetcher.mockResolvedValue(Response.json({choices:[{finish_reason:'length',message:{content:JSON.stringify(output())}}]}));
    await expect(verifySyllabusWithGroq(text,target,'test-key',fetcher)).rejects.toThrow('incomplete');
  });
  it('fails closed on quota, invalid JSON, network failure and missing credentials',async()=>{
    await expect(verifySyllabusWithGroq(text,target,'',vi.fn())).rejects.toThrow('not configured');
    await expect(verifySyllabusWithGroq(text,target,'test',vi.fn().mockResolvedValue(new Response('private provider details',{status:429})))).rejects.toThrow('usage limit');
    await expect(verifySyllabusWithGroq(text,target,'test',vi.fn().mockRejectedValue(new Error('secret')))).rejects.toThrow('could not be reached');
    await expect(verifySyllabusWithGroq(text,target,'test',vi.fn().mockResolvedValue(Response.json({choices:[{finish_reason:'stop',message:{content:'invalid'}}]})))).rejects.toThrow();
  });
});

it.skipIf(process.env.RUN_SYLLABUS_GROQ_LIVE!=='true')('checks synthetic positive, contradictory and wrong-professor documents using the real Groq API',async()=>{
  const result=await verifySyllabusWithGroq(text,target);
  expect(result.preferences).toContain('online_quizzes');
  const negative=await verifySyllabusWithGroq(text.replace('Attendance is optional.','Attendance is required and contributes to the final grade.'),target);
  expect(negative.preferences).not.toContain('optional_attendance');
  await expect(verifySyllabusWithGroq(text.replace('Jarrett Billingsley','Different Instructor'),target)).rejects.toMatchObject({mismatch:true});
},90000);
