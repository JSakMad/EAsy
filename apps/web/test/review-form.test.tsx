import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReviewForm } from '../components/review-form';
const mocks=vi.hoisted(()=>({submit:vi.fn().mockResolvedValue({error:'Try again later.'})}));
vi.mock('../app/catalog/[code]/actions',()=>({submitReview:mocks.submit}));
afterEach(()=>{cleanup();mocks.submit.mockClear();});

describe('student review form',()=>{
  it('selects an existing professor and preserves the review after a save error',async()=>{
    const id='12345678-1234-1234-1234-123456789abc';
    const {container}=render(<ReviewForm code="CS 0447" professors={[{id,name:'Jane Example',department:'Computer Science'}]}/>);
    fireEvent.change(screen.getByLabelText('Professor'),{target:{value:'Jane'}});
    fireEvent.click(screen.getByRole('button',{name:/Jane Example/}));
    fireEvent.change(screen.getByLabelText(/Did you receive/),{target:{value:'yes'}});
    fireEvent.change(screen.getByLabelText('How difficult was the class?'),{target:{value:'2'}});
    fireEvent.click(screen.getByRole('checkbox',{name:'Online classes'}));
    fireEvent.change(screen.getByLabelText(/Comments about the class/),{target:{value:'My class experience.'}});
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Try again'));
    const sent=mocks.submit.mock.calls[0]![2] as FormData;
    expect(sent.get('professorId')).toBe(id);
    expect(sent.getAll('tags')).toEqual(['online_classes']);
    expect(sent.get('difficulty')).toBe('2');
    expect((screen.getByLabelText(/Comments about the class/) as HTMLTextAreaElement).value).toBe('My class experience.');
    expect((screen.getByRole('checkbox',{name:'Online classes'}) as HTMLInputElement).checked).toBe(true);
  });
});
