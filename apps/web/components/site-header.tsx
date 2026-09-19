import Link from "next/link";
import { GraduationCap } from "lucide-react";

export function SiteHeader() {
  return <header className="site-header">
    <Link href="/" className="brand" aria-label="EAsy home">
      <span className="brand-mark"><GraduationCap size={21} strokeWidth={2.4} /></span>
      <span className="wordmark">E<span>A</span>sy<span className="brand-period">.</span></span>
    </Link>
    <div className="school-pill"><span className="school-dot" /> University of Pittsburgh</div>
  </header>;
}
