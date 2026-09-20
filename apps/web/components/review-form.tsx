'use client';
import { useActionState, useState } from 'react';
import { CLASS_PREFERENCES, type ClassPreference } from '@easy-a/core';
import { submitReview } from '@/app/catalog/[code]/actions';
import type { ProfessorChoice } from '@/lib/student-reviews';

export function ReviewForm({ code, professors }: { code: string; professors: ProfessorChoice[] }) {
  const [professorName, setProfessorName] = useState('');
  const [professorId, setProfessorId] = useState('');
  const [grade, setGrade] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [tags, setTags] = useState<ClassPreference[]>([]);
  const [comments, setComments] = useState('');
  const [state, action, pending] = useActionState(submitReview.bind(null, code), {});
  const matches = professorName.trim().length > 1 && !professorId
    ? professors.filter(p => p.name.toLowerCase().includes(professorName.toLowerCase())).slice(0,8) : [];
  return <form action={action} onReset={event=>event.preventDefault()} className="profile-form review-form">
    <div>
      <label htmlFor="review-professor">Professor</label>
      <input id="review-professor" name="professorName" required minLength={2} maxLength={120} autoComplete="off"
        value={professorName} onChange={event => { setProfessorName(event.target.value); setProfessorId(''); }} placeholder="Search professors or type a new name" aria-describedby="professor-hint" />
      <input type="hidden" name="professorId" value={professorId} />
      {matches.length>0 && <ul className="review-professors" aria-label="Matching professors">{matches.map(p => <li key={p.id}>
        <button type="button" onClick={() => { setProfessorName(p.name); setProfessorId(p.id); }}>{p.name}<small>{p.department}</small></button>
      </li>)}</ul>}
      <p id="professor-hint">Choose a matching professor if listed. Otherwise, enter their full name.</p>
    </div>
    <div><label htmlFor="review-grade">Did you receive an A or A−?</label>
      <select id="review-grade" name="receivedA" required value={grade} onChange={event=>setGrade(event.target.value)}><option value="" disabled>Select your result</option><option value="yes">Yes — A or A−</option><option value="no">No</option></select>
    </div>
    <div><label htmlFor="review-difficulty">How difficult was the class?</label>
      <select id="review-difficulty" name="difficulty" required value={difficulty} onChange={event=>setDifficulty(event.target.value)}><option value="" disabled>Select difficulty</option>
        <option value="1">1 / 5 — Very easy</option><option value="2">2 / 5 — Easy</option><option value="3">3 / 5 — Moderate</option><option value="4">4 / 5 — Difficult</option><option value="5">5 / 5 — Very difficult</option>
      </select>
    </div>
    <fieldset className="preference-picker"><legend>Which features did this class have?</legend>
      <p>Select the features you actually experienced. These are the same choices used for personal scores.</p>
      <div className="preference-options">{CLASS_PREFERENCES.map(tag => <label className="preference-option" key={tag.id}>
        <input type="checkbox" name="tags" value={tag.id} checked={tags.includes(tag.id)} onChange={event=>setTags(old=>event.target.checked?[...old,tag.id]:old.filter(value=>value!==tag.id))} /><span>{tag.label}</span>
      </label>)}</div>
    </fieldset>
    <div><label htmlFor="review-comments">Comments about the class <span>(optional)</span></label>
      <textarea id="review-comments" name="comments" rows={5} maxLength={3000} value={comments} onChange={event=>setComments(event.target.value)} placeholder="What should another student know about this class?" aria-describedby="comments-hint" />
      <p id="comments-hint">Up to 3,000 characters. Your review is public; your name and email are not displayed. Focus on your class experience.</p>
    </div>
    <p>The submission date is recorded automatically. One review per professor and course.</p>
    {state.error && <p role="alert" className="auth-error">{state.error}</p>}
    <button className="auth-button" type="submit" disabled={pending}>{pending ? 'Submitting…' : 'Submit review'}</button>
  </form>;
}
