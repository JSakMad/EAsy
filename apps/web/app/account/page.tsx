import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SignOut } from "@/components/auth-controls";
import { requireStudentProfile } from "@/lib/profile-access";
import { CLASS_PREFERENCES } from '@easy-a/core';

export const metadata: Metadata = { title: "My account", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { user, profile } = await requireStudentProfile();
  return <>
    <SiteHeader />
    <main className="auth-main">
      <section className="auth-card" aria-labelledby="account-title">
        <p className="section-kicker">Your EAsy account</p>
        <h1 id="account-title">Welcome, {profile.name}.</h1>
        <dl className="account-details">
          <dt>Email</dt><dd>{user.email}</dd>
          <dt>Year of schooling</dt><dd>{profile.schoolYear}</dd>
          <dt>Major</dt><dd>{profile.major}</dd>
          <dt>Class preferences</dt><dd>{CLASS_PREFERENCES.filter(p => profile.preferences?.includes(p.id)).map(p => p.label).join(', ') || 'No preferences selected'}</dd>
          <dt>Sign-in method</dt><dd>Google</dd>
          <dt>Member since</dt><dd>{new Intl.DateTimeFormat("en-US", {
            dateStyle: "long", timeZone: "UTC",
          }).format(new Date(user.createdAt))}</dd>
        </dl>
        <Link className="auth-back" href="/account/setup">Edit profile</Link>
        <SignOut />
        <Link className="auth-back" href="/">Browse courses</Link>
      </section>
    </main>
  </>;
}
