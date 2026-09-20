'use client';
export default function CatalogError({ reset }: { reset: () => void }) {
  return <main className="auth-main"><section className="auth-card"><h1>Could not load the catalog</h1><p>Please try again.</p><button className="auth-button" onClick={reset}>Try again</button></section></main>;
}
