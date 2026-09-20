import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'LSU demo · EAsy', template: '%s · LSU demo · EAsy' },
  description: 'A fictional Louisiana State University course guide demonstrating EAsy at another school.',
  robots: { index: false, follow: false },
  openGraph: { title: 'LSU demo · EAsy', description: 'A fictional course and professor for a proof of concept.' },
  twitter: { title: 'LSU demo · EAsy', description: 'A fictional course and professor for a proof of concept.' },
};

export default function LsuLayout({ children }: { children: React.ReactNode }) {
  return <div className="school-lsu">{children}</div>;
}
