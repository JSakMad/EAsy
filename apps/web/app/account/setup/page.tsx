import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { ProfileForm } from "@/components/profile-form";
import { SignOut } from "@/components/auth-controls";
import { requireSession } from "@/lib/session";
import { getStudentProfile } from "@/lib/student-profile";

export const metadata: Metadata = { title: "Your student profile", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ProfileSetupPage() {
  const { user } = await requireSession();
  const profile = await getStudentProfile(user.id);
  return <>
    <SiteHeader />
    <main className="auth-main">
      <section className="auth-card" aria-labelledby="profile-title">
        <p className="section-kicker">Your EAsy account</p>
        <h1 id="profile-title">{profile?.preferences === null ? "Choose your class preferences" : profile ? "Edit your profile" : "Tell us about yourself"}</h1>
        <p>{profile ? "Review your details and choose the class features you prefer to personalize professor scores." : "Confirm your name, add your year of schooling and major, and choose your class preferences to finish setting up your account."}</p>
        <ProfileForm initial={profile ?? { name: user.name, schoolYear: "", major: "", preferences: null }} editing={Boolean(profile)} />
        <SignOut />
      </section>
    </main>
  </>;
}
