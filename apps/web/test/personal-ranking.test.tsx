import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BrowseExperience } from '../components/browse-experience';
import { demoOfferings } from '../lib/demo-data';
import { ProfileForm } from '../components/profile-form';

vi.mock('../components/site-header', () => ({ SiteHeader: () => <header>EAsy</header> }));
vi.mock('../app/account/setup/actions', () => ({ saveProfile: vi.fn() }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const courses = [{ courseCode: 'CS 0447', courseTitle: null, professorCount: 2, reviewCount: 40 }];
const offerings = [
  { ...demoOfferings[0]!, id: 'base', courseCode: 'CS 0447', professorName: 'Higher baseline', score: 65, reviewCount: 20, tags: [], tagEvidence: {} },
  { ...demoOfferings[0]!, id: 'fit', courseCode: 'CS 0447', professorName: 'Quiz match', score: 60, reviewCount: 20, tags: ['online_quizzes'], tagEvidence: { online_quizzes: 3 } },
];
function response() { vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => Response.json({ data: offerings }))); }

describe('personalized course comparisons', () => {
  it('opens a catalog course with a special suffix from its comparison link', async () => {
    response();
    render(<BrowseExperience courses={[{...courses[0]!,courseCode:'NUR 1140IS'}]} demo={false} initialCode="NUR1140IS" />);
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
    expect(screen.getByRole('heading',{name:'NUR 1140IS'})).toBeTruthy();
  });
  it('replaces scores and orders professors by preferences', async () => {
    response();
    render(<BrowseExperience courses={courses} demo={false} initialCode="CS 0447" preferences={['online_quizzes']} />);
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
    const first = screen.getAllByRole('article')[0]!;
    expect(within(first).getByText('Quiz match')).toBeTruthy();
    expect(within(first).getByText('72')).toBeTruthy();
    expect(within(first).getByText('FOR YOU / 100')).toBeTruthy();
    expect(within(first).queryByText('60')).toBeNull();
    expect(within(first).getByText('Matches your preferences:')).toBeTruthy();
  });
  it('keeps anonymous comparisons on the original scores', async () => {
    response();
    render(<BrowseExperience courses={courses} demo={false} initialCode="CS 0447" />);
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
    expect(within(screen.getAllByRole('article')[0]!).getByText('Higher baseline')).toBeTruthy();
    expect(screen.queryByText('FOR YOU / 100')).toBeNull();
  });
  it('prefills saved checkboxes and allows clearing preferences', () => {
    const { container } = render(<ProfileForm editing initial={{ name: 'Student', schoolYear: 'First year', major: 'Undeclared', preferences: ['online_quizzes'] }} />);
    const quiz = screen.getByRole('checkbox', { name: 'Online quizzes' }) as HTMLInputElement;
    expect(quiz.checked).toBe(true);
    fireEvent.click(quiz);
    const form = new FormData(container.querySelector('form')!);
    expect(form.getAll('preferences')).toEqual([]);
    expect(form.get('preferencesReviewed')).toBe('1');
    expect(screen.getByText(/Matches use online-class reports from EAsy students/)).toBeTruthy();
  });
});

describe('front-page course discovery',()=>{
  it('finds courses by professor and distinguishes absent courses',()=>{
    render(<BrowseExperience courses={[{...courses[0]!,courseTitle:'Computer Organization',professorNames:['Ada Example']}]} demo={false}/>);
    const search=screen.getByRole('textbox',{name:'Search by course code, name, or professor'});
    for(const value of ['cs0447','Computer Organization','Ada Example']) {
      fireEvent.change(search,{target:{value}});
      expect(screen.getByRole('button',{name:'Compare professors for CS 0447'})).toBeTruthy();
    }
    fireEvent.change(search,{target:{value:'NOTREAL999'}});
    expect(screen.getByText('This course does not exist in our course data')).toBeTruthy();
  });
  it('invites a first review for an existing course without reviews',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({data:[]})));
    render(<BrowseExperience courses={[{...courses[0]!,professorCount:0,reviewCount:0}]} demo={false} initialCode="CS0447"/>);
    expect(await screen.findByText('No reviews yet for this course')).toBeTruthy();
    expect(screen.getByRole('link',{name:'Leave the first review'}).getAttribute('href')).toBe('/catalog/CS%200447');
  });
});
