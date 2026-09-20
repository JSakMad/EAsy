import Link from "next/link";
import { AccountNav } from "./account-nav";
import { SchoolSwitcher } from './school-switcher';

export function SiteHeader({ school = 'pitt' }: { school?: 'pitt' | 'lsu' }) {
  return <header className="site-header">
    <Link href={school === 'lsu' ? '/schools/lsu' : '/'} className="brand" aria-label="EAsy home">
      <span className="wordmark">E<span>A</span>sy</span>
    </Link>
    <div className="header-actions">
      <SchoolSwitcher school={school} />
      {school === 'pitt' ? <AccountNav /> : <span className="school-pill">Demo edition</span>}
    </div>
  </header>;
}
