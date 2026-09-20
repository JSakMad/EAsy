import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SyllabusUpload } from '../components/syllabus-upload';
const mocks=vi.hoisted(()=>({upload:vi.fn().mockResolvedValue({mismatch:true,error:'Wrong course or professor. Upload a different syllabus.'})}));
vi.mock('../app/offerings/[id]/syllabus-actions',()=>({uploadSyllabus:mocks.upload}));
afterEach(()=>{cleanup();vi.restoreAllMocks();});

it('opens and closes a mismatch dialog after the server rejects a document',async()=>{
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  const {container}=render(<SyllabusUpload offeringId="offering-id"/>);
  fireEvent.submit(container.querySelector('form')!);
  await waitFor(()=>expect(screen.getByRole('dialog')).toBeTruthy());
  expect(screen.getByRole('heading',{name:'Syllabus doesn’t match'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Choose a different syllabus'}));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(mocks.upload.mock.calls[0]?.[0]).toBe('offering-id');
});
