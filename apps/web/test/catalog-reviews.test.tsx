// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CATALOG_COURSES, getCatalogCourse, searchCatalog } from '../lib/catalog';
import { validateReview } from '../lib/review-fields';

const mocks = vi.hoisted(() => ({ requireProfile: vi.fn(), save: vi.fn(), revalidate: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/profile-access', () => ({ requireStudentProfile: mocks.requireProfile }));
vi.mock('@/lib/student-reviews', () => ({ saveStudentReview: mocks.save, ReviewWriteError: class extends Error {} }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error('Redirect: '+url); } }));
import { submitReview } from '../app/catalog/[code]/actions';

function form(values: Record<string,string> = {}) {
  const data = new FormData();
  for (const [key,value] of Object.entries({ professorName:'Professor Example', receivedA:'yes', difficulty:'3', comments:'Useful class.', ...values })) data.set(key,value);
  return data;
}

describe('complete searchable course catalog', () => {
  it('contains unique courses with their supplied field-of-study tags', () => {
    expect(CATALOG_COURSES.length).toBe(6114);
    expect(new Set(CATALOG_COURSES.map(c=>c.code)).size).toBe(CATALOG_COURSES.length);
    expect(CATALOG_COURSES.every(c=>c.title && c.fieldsOfStudy.length)).toBe(true);
  });
  it('searches compact codes, titles, fields, and alternative titles', () => {
    expect(searchCatalog('cs0447').courses[0]?.code).toBe('CS 0447');
    expect(searchCatalog('accounting').total).toBeGreaterThan(10);
    expect(searchCatalog('','Accounting').courses.every(c=>c.fieldsOfStudy.includes('Accounting'))).toBe(true);
    expect(getCatalogCourse('NUR1140IS')?.code).toBe('NUR 1140IS');
    expect(getCatalogCourse('NUR%201140IS')?.code).toBe('NUR 1140IS');
    expect(getCatalogCourse('CS%200447')?.code).toBe('CS 0447');
    expect(getCatalogCourse('%invalid')).toBeNull();
    expect(searchCatalog('diversity current economic').courses.some(c=>c.code==='ECON 1910')).toBe(true);
  });
  it('paginates and safely bounds invalid page numbers', () => {
    expect(searchCatalog().courses).toHaveLength(24);
    expect(searchCatalog('', '', -10).page).toBe(1);
    expect(searchCatalog('', '', Infinity).page).toBe(1);
    expect(searchCatalog('zzzzunlikelycourse').total).toBe(0);
    expect(searchCatalog('', '', 2).courses[0]?.code).not.toBe(searchCatalog().courses[0]?.code);
  });
});

describe('student review validation', () => {
  it('requires professor, an explicit grade answer, and integer difficulty 1–5', () => {
    const invalid: Record<string,string>[] = [{professorName:''},{receivedA:''},{receivedA:'maybe'},{difficulty:'0'},{difficulty:'6'},{difficulty:'2.5'}];
    for (const values of invalid) {
      expect(validateReview(form(values)).error).toBeTruthy();
    }
    expect(validateReview(form({receivedA:'no'})).data?.receivedA).toBe(false);
  });
  it('only accepts preference tags, bounds comments, and ignores user-supplied timestamps', () => {
    expect(validateReview(form({tags:'forged'})).error).toBeTruthy();
    expect(validateReview(form({comments:'x'.repeat(3001)})).error).toBeTruthy();
    const data=form({tags:'online_classes',submitted_at:'2000-01-01',userId:'someone-else'});
    data.append('tags','online_classes');
    const review=validateReview(data).data!;
    expect(review.tags).toEqual(['online_classes']);
    expect(review).not.toHaveProperty('submitted_at');
    expect(review).not.toHaveProperty('userId');
  });
});

describe('review submission authorization', () => {
  beforeEach(()=>{vi.resetAllMocks();mocks.requireProfile.mockResolvedValue({user:{id:'session-owner'}});});
  it('rejects an unauthenticated submission before writing', async()=>{
    mocks.requireProfile.mockRejectedValue(new Error('Redirect: /sign-in'));
    await expect(submitReview('CS0447',{},form())).rejects.toThrow('/sign-in');
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('checks course membership and fields on the server', async()=>{
    expect((await submitReview('NOT A COURSE',{},form())).error).toBeTruthy();
    expect((await submitReview('CS0447',{},form({difficulty:'7'}))).error).toBeTruthy();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('takes the author from the session and redirects to the reviewed course', async()=>{
    mocks.save.mockResolvedValue({id:'review-id',offeringId:'offering-id'});
    await expect(submitReview('CS0447',{},form({userId:'another-user'}))).rejects.toThrow('/catalog/CS%200447?submitted=1');
    expect(mocks.save.mock.calls[0]?.[0]).toBe('session-owner');
    expect(mocks.revalidate).toHaveBeenCalledWith('/offerings/offering-id');
  });
  it('keeps internal database errors out of the form', async()=>{
    mocks.save.mockRejectedValue(new Error('postgres://private:secret@db'));
    const result=await submitReview('CS0447',{},form());
    expect(result.error).toContain('try again');
    expect(result.error).not.toContain('secret');
  });
});
