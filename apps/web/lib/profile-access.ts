import "server-only";
import { redirect } from "next/navigation";
import { getSession, requireSession } from "./session";
import { getStudentProfile } from "./student-profile";

export async function requireStudentProfile() {
  const session = await requireSession();
  const profile = await getStudentProfile(session.user.id);
  if (!profile || profile.preferences === null) redirect("/account/setup");
  return { ...session, profile };
}

// Anonymous browsing remains public; signed-in students must finish setup.
export async function checkStudentSetup() {
  const session = await getSession();
  if (!session) return null;
  const profile = await getStudentProfile(session.user.id);
  if (!profile || profile.preferences === null) redirect("/account/setup");
  return profile;
}
