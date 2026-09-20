import Link from "next/link";
import { AccountNav } from "./account-nav";

export function SiteHeader() {
  return <header className="site-header">
    <Link href="/" className="brand" aria-label="EAsy home">
      <span className="wordmark">E<span>A</span>sy<span className="brand-period">.</span></span>
    </Link>
    <div className="header-actions">
      <div className="school-pill">An unofficial Pitt course guide</div>
      <AccountNav />
    </div>
  </header>;
}
