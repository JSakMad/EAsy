// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyllabusError } from '../lib/syllabus-check';
import { extractSyllabus } from '../lib/syllabus-file';
import { SyllabusPdfBinaryDataFactory } from '../lib/syllabus-pdf-assets';

vi.mock('server-only',()=>({}));
const mocks = vi.hoisted(()=>({ auth:vi.fn(), review:vi.fn(), reserve:vi.fn(), save:vi.fn(), revalidate:vi.fn(), verify:vi.fn() }));
vi.mock('@/lib/profile-access',()=>({requireStudentProfile:mocks.auth}));
vi.mock('@/lib/syllabus-store',()=>({syllabusReview:mocks.review,reserveSyllabusAttempt:mocks.reserve,saveSyllabusCheck:mocks.save}));
vi.mock('@/lib/syllabus-ai',()=>({verifySyllabusWithGroq:mocks.verify}));
vi.mock('next/cache',()=>({revalidatePath:mocks.revalidate}));
import { uploadSyllabus } from '../app/offerings/[id]/syllabus-actions';

const target={courseCode:'CS 0447',courseTitle:'Computer Organization and Assembly Language',professorName:'Jarrett Billingsley'};
const header='CS0447\nComputer Organization & Assembly Language\nInstructor: Dr. Jarrett Billingsley\nCourse syllabus\n';
const text=header+'All quizzes are online.\nAttendance is optional.\nExtra credit is offered.';
function form(content=text) { const f=new FormData();f.set('syllabus',new File([content],'syllabus.txt',{type:'text/plain'}));return f; }

describe('conservative syllabus checks',()=>{
  it('rejects fake PDF files, unsupported formats, empty files and excessive size',async()=>{
    for(const file of [new File(['not a pdf'],'test.pdf',{type:'application/pdf'}),new File([text],'test.docx'),new File([],'empty.txt',{type:'text/plain'}),new File([new Uint8Array(2*1024*1024+1)],'large.txt',{type:'text/plain'})]) await expect(extractSyllabus(file)).rejects.toThrow();
    expect((await extractSyllabus(new File([text],'syllabus.txt',{type:'text/plain'}))).text).toBe(text);
  });
  it.each(['Helvetica', 'Times-Roman', 'Courier'])('extracts %s PDFs using bundled fonts without font warnings',async(font)=>{
    const assets=vi.spyOn(SyllabusPdfBinaryDataFactory.prototype,'fetch');
    const log=vi.spyOn(console,'log');
    const warn=vi.spyOn(console,'warn');
    try {
    const content='BT /F1 12 Tf 40 750 Td '+text.split('\n').map(line=>`(${line}) Tj 0 -18 Td`).join(' ')+' ET';
    const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',`<< /Type /Font /Subtype /Type1 /BaseFont /${font} >>`,`<< /Length ${content.length} >>\nstream\n${content}\nendstream`];
    let pdf='%PDF-1.4\n';const offsets=[0];
    objects.forEach((object,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${object}\nendobj\n`;});
    const xref=pdf.length;pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const result=await extractSyllabus(new File([pdf],'syllabus.pdf',{type:'application/pdf'}));
    expect(result.text).toContain('CS0447');
    expect(result.text.replace(/\s+/g,' ')).toContain('All quizzes are online.');
    expect(result.bytes.byteLength).toBe(pdf.length);
    expect(assets).toHaveBeenCalledWith(expect.objectContaining({kind:'standardFontDataUrl'}));
    expect(JSON.stringify([...log.mock.calls,...warn.mock.calls])).not.toMatch(/standardFontDataUrl|Unable to load font/);
    } finally { assets.mockRestore();log.mockRestore();warn.mockRestore(); }
  });
});

describe('authenticated syllabus submission',()=>{
  beforeEach(()=>{vi.resetAllMocks();mocks.verify.mockResolvedValue({preferences:['online_quizzes'],tags:['online_quizzes']});mocks.auth.mockResolvedValue({user:{id:'owner'}});mocks.review.mockResolvedValue({...target,reviewId:'review',tags:['online_quizzes']});});
  it('requires authentication before processing a file',async()=>{
    mocks.auth.mockRejectedValue(new Error('sign in'));
    await expect(uploadSyllabus('offering',{},form())).rejects.toThrow('sign in');
    expect(mocks.review).not.toHaveBeenCalled();
  });
  it('returns mismatch popup state without saving checks',async()=>{
    mocks.verify.mockRejectedValue(new SyllabusError('Wrong class or professor. Upload a different syllabus.',true));
    const result=await uploadSyllabus('offering',{},form(text.replace('CS0447','CS0441')));
    expect(result.mismatch).toBe(true);expect(result.error).toContain('different syllabus');expect(mocks.save).not.toHaveBeenCalled();
  });
  it('uses the authenticated review and saves only hash and supported tags',async()=>{
    const f=form();f.set('userId','someone-else');f.set('tags','extra_credit');
    expect((await uploadSyllabus('offering',{},f)).success).toContain('1 of your reported');
    expect(mocks.review).toHaveBeenCalledWith('owner','offering');
    expect(mocks.save).toHaveBeenCalledWith('review',expect.stringMatching(/^[a-f0-9]{64}$/),{preferences:['online_quizzes'],tags:['online_quizzes']});
    expect(JSON.stringify(mocks.save.mock.calls)).not.toContain('Jarrett');
  });
  it('hides database failures from users',async()=>{
    mocks.reserve.mockRejectedValue(new Error('secret connection string'));
    expect((await uploadSyllabus('offering',{},form())).error).toBe('Syllabus checking is temporarily unavailable. Please try again shortly.');
  });
});
