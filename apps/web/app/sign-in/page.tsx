import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { GoogleSignIn } from "@/components/auth-controls";
import { isAuthConfigured } from "@/lib/auth-config";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: {
  searchParams: Promise<{ error?: string }>;
}) {
  let available = isAuthConfigured();
  let session = null;
  try { session = await getSession(); } catch { available = false; }
  if (session) redirect("/account");
  const params = await searchParams;
  return <>
    <SiteHeader />
    <main className="auth-main">
      <section className="auth-card" aria-labelledby="sign-in-title">
        <p className="section-kicker">Your EAsy account</p>
        <h1 id="sign-in-title">Welcome to EAsy.</h1>
        <p>Sign in with Google to access your account. New here? Your first sign-in creates an account automatically.</p>
        <GoogleSignIn enabled={available} failed={Boolean(params.error)} />
        <p className="auth-note">We use your Google name, email, and profile picture to create your account.</p>
        <Link className="auth-back" href="/">Continue browsing courses</Link>
      </section>
    </main>
  </>;
}
