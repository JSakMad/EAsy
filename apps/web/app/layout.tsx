import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";
import './easy.css';
import './overview.css';

const manrope = Manrope({ subsets: ["latin"], variable: "--font-body" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"),
  title: { default: "EAsy — Your course. Your best fit.", template: "%s · EAsy" },
  description: "Find your Pitt course, then compare professors by reported grades, difficulty, and class structure.",
  openGraph: {
    title: "EAsy — Pitt course comparisons",
    description: "Your course. Your best fit. Compare professors for the class you need.",
    images: [],
  },
  twitter: { card: "summary", title: "EAsy — Pitt", description: "Find your course. Compare your professors.", images: [] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${manrope.variable} ${spaceGrotesk.variable}`}>{children}</body></html>;
}
