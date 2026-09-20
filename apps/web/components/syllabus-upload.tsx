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
      <input id="syllabus-file" type="file" name="syllabus" accept=".pdf,.txt,application/pdf,text/plain" required aria-describedby="syllabus-help" onChange={event => {
        const input = event.currentTarget;
        input.setCustomValidity(input.files?.[0] && input.files[0].size > SYLLABUS_MAX_BYTES ? 'Choose a file smaller than 2 MB.' : '');
      }}/>
      <p id="syllabus-help">PDF or .txt, up to 2 MB and 30 pages. Scanned images are not supported. The course code, full course title, and instructor name must appear near the start.</p>
      <button className="auth-button" disabled={pending}>{pending ? 'Checking syllabus…' : 'Check my review against the syllabus'}</button>
      {state.error && <p role="alert" className="auth-error">{state.error}</p>}
      {state.success && <p role="status">{state.success}</p>}
    </form>
    <dialog ref={dialog} className="syllabus-dialog" aria-labelledby="syllabus-mismatch-title"><h2 id="syllabus-mismatch-title">Syllabus doesn’t match</h2><p>{state.error}</p><button className="auth-button" onClick={()=>dialog.current?.close()} autoFocus>Choose a different syllabus</button></dialog>
  </>;
}
