"use client";

import Link from "next/link";

export default function AccountError({ reset }: { reset: () => void }) {
  return <main className="auth-main"><section className="auth-card">
    <h1>Account temporarily unavailable</h1>
    <p>We couldn’t load your account. Please try again.</p>
    <button className="auth-button" onClick={reset}>Try again</button>
    <Link className="auth-back" href="/">Browse courses</Link>
  </section></main>;
}
