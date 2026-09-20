'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

const schools = [
  { id: 'pitt', name: 'University of Pittsburgh', short: 'Pitt', aliases: 'pitt pittsburgh', href: '/', note: 'Course guide' },
  { id: 'lsu', name: 'Louisiana State University', short: 'LSU', aliases: 'lsu louisiana luisiana', href: '/schools/lsu', note: 'Proof of concept' },
] as const;

export function SchoolSwitcher({ school = 'pitt' }: { school?: 'pitt' | 'lsu' }) {
  const [query, setQuery] = useState('');
  const details = useRef<HTMLDetailsElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const matches = schools.filter(item => `${item.name} ${item.aliases}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <details className="school-switcher" ref={details}
    onToggle={() => { if (details.current?.open) input.current?.focus(); else setQuery(''); }}
    onKeyDown={event => { if (event.key === 'Escape' && details.current) { details.current.open = false; details.current.querySelector('summary')?.focus(); } }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}>
    <summary aria-label="Choose your school">{schools.find(item => item.id === school)?.short}<ChevronDown size={15} /></summary>
    <div className="school-dropdown">
      <label htmlFor="school-search">Find your school</label>
      <div className="school-search-field"><Search size={16}/><input id="school-search" ref={input} value={query} onChange={event => setQuery(event.target.value)} placeholder="School name or abbreviation" autoComplete="off" /></div>
      <ul>{matches.map(item => <li key={item.id}><Link href={item.href} aria-current={item.id === school ? 'page' : undefined} onClick={() => { if (details.current) details.current.open = false; }}>
        <strong>{item.name}</strong><small>{item.note}{item.id === school ? ' · Current school' : ''}</small>
      </Link></li>)}</ul>
      {matches.length === 0 && <p role="status">This school is not available yet.</p>}
    </div>
  </details>;
}
