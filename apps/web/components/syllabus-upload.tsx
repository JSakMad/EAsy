'use client';

import { useActionState, useEffect, useRef } from 'react';
import { uploadSyllabus } from '@/app/offerings/[id]/syllabus-actions';
import { SYLLABUS_MAX_BYTES } from '@/lib/syllabus-check';

export function SyllabusUpload({ offeringId }: { offeringId: string }) {
  const [state, action, pending] = useActionState(uploadSyllabus.bind(null, offeringId), {});
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (state.mismatch && !dialog.current?.open) dialog.current?.showModal(); }, [state]);
  return <>
    <form action={action} className="syllabus-form">
      <label htmlFor="syllabus-file">Upload this professor’s syllabus for this course</label>
      <input id="syllabus-file" type="file" name="syllabus" accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" required aria-describedby="syllabus-help" onChange={event => {
        const input = event.currentTarget;
        input.setCustomValidity(input.files?.[0] && input.files[0].size > SYLLABUS_MAX_BYTES ? 'Choose a file smaller than 2 MB.' : '');
      }}/>
      <p id="syllabus-help">PDF, Word (.doc or .docx), or .txt, up to 2 MB. PDFs may have up to 30 pages; scanned images are not supported. Groq AI checks the course, instructor, and your reported tags using the extracted document text.</p>
      <button className="auth-button" disabled={pending}>{pending ? 'Checking syllabus…' : 'Check my review with AI'}</button>
      {state.error && <p role="alert" className="auth-error">{state.error}</p>}
      {state.success && <p role="status">{state.success}</p>}
    </form>
    <dialog ref={dialog} className="syllabus-dialog" aria-labelledby="syllabus-mismatch-title"><h2 id="syllabus-mismatch-title">Syllabus doesn’t match</h2><p>{state.error}</p><button className="auth-button" onClick={()=>dialog.current?.close()} autoFocus>Choose a different syllabus</button></dialog>
  </>;
}
