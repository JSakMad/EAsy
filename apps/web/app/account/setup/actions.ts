"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { saveStudentProfile } from "@/lib/student-profile";
import { validateProfile, type ProfileFormState } from "@/lib/profile-fields";

export async function saveProfile(_previous: ProfileFormState, form: FormData): Promise<ProfileFormState> {
  const session = await requireSession();
  const { profile, errors, valid } = validateProfile(form);
  if (!valid) return { errors };
  try {
    await saveStudentProfile(session.user.id, profile);
  } catch {
    return { message: "We couldn't save your profile. Please try again." };
  }
  revalidatePath("/", "layout");
  redirect("/");
}
