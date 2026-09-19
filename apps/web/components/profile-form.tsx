"use client";

import { useActionState } from "react";
import { saveProfile } from "@/app/account/setup/actions";
import { SCHOOL_YEARS, type StudentProfile } from "@/lib/profile-fields";
import { CLASS_PREFERENCES } from '@easy-a/core';

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
    <fieldset className="preference-picker" aria-describedby="preferences-hint">
      <legend>What works best for you?</legend>
      <p id="preferences-hint">Select the class features you prefer. You can leave everything unchecked if you have no preferences, and change these later.</p>
      <input type="hidden" name="preferencesReviewed" value="1" />
      <div className="preference-options">
        {CLASS_PREFERENCES.map(preference => <label key={preference.id} className="preference-option">
          <input type="checkbox" name="preferences" value={preference.id} defaultChecked={initial.preferences?.includes(preference.id) ?? false} />
          <span>{preference.label}{preference.tags.length === 0 && <small>Saved for later. Class-format data isn't available yet.</small>}</span>
        </label>)}
      </div>
      {state.errors?.preferences && <p className="auth-error">{state.errors.preferences}</p>}
    </fieldset>
    <div aria-live="polite">
      {state.message && <p className="auth-error" role="alert">{state.message}</p>}
      {state.errors && <p className="auth-error" role="alert">Check the highlighted fields.</p>}
    </div>
    <button className="auth-button" type="submit" disabled={pending}>
      {pending ? "Saving…" : editing ? "Save changes" : "Save and continue"}
    </button>
  </form>;
}
