"use client";

import { useActionState } from "react";
import { saveProfile } from "@/app/account/setup/actions";
import { SCHOOL_YEARS, type StudentProfile } from "@/lib/profile-fields";

export function ProfileForm({ initial, editing }: { initial: StudentProfile; editing: boolean }) {
  const [state, action, pending] = useActionState(saveProfile, {});
  return <form action={action} className="profile-form">
    <div>
      <label htmlFor="profile-name">Name</label>
      <input id="profile-name" name="name" autoComplete="name" defaultValue={initial.name} required maxLength={100}
        aria-invalid={Boolean(state.errors?.name)} aria-describedby={state.errors?.name ? "name-error" : undefined} />
      {state.errors?.name && <p id="name-error" className="auth-error">{state.errors.name}</p>}
    </div>
    <div>
      <label htmlFor="school-year">Year of schooling</label>
      <select id="school-year" name="schoolYear" defaultValue={initial.schoolYear} required
        aria-invalid={Boolean(state.errors?.schoolYear)} aria-describedby={state.errors?.schoolYear ? "year-error" : undefined}>
        <option value="" disabled>Select your year</option>
        {SCHOOL_YEARS.map(year => <option key={year} value={year}>{year}</option>)}
      </select>
      {state.errors?.schoolYear && <p id="year-error" className="auth-error">{state.errors.schoolYear}</p>}
    </div>
    <div>
      <label htmlFor="profile-major">Major</label>
      <input id="profile-major" name="major" defaultValue={initial.major} required maxLength={120}
        placeholder="e.g. Computer Science" aria-invalid={Boolean(state.errors?.major)}
        aria-describedby={state.errors?.major ? "major-hint major-error" : "major-hint"} />
      <p id="major-hint" className="auth-note">Still deciding? Enter Undeclared.</p>
      {state.errors?.major && <p id="major-error" className="auth-error">{state.errors.major}</p>}
    </div>
    <div aria-live="polite">
      {state.message && <p className="auth-error" role="alert">{state.message}</p>}
      {state.errors && <p className="auth-error" role="alert">Check the highlighted fields.</p>}
    </div>
    <button className="auth-button" type="submit" disabled={pending}>
      {pending ? "Saving…" : editing ? "Save changes" : "Save and continue"}
    </button>
  </form>;
}
