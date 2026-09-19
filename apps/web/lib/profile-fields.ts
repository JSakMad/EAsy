export const SCHOOL_YEARS = [
  "First year", "Second year", "Third year", "Fourth year",
  "Fifth year or later", "Graduate student", "Other",
] as const;

export type StudentProfile = { name: string; schoolYear: string; major: string };
export type ProfileFormState = {
  errors?: Partial<Record<keyof StudentProfile, string>>;
  message?: string;
};

export function validateProfile(form: FormData) {
  const read = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  };
  const profile: StudentProfile = {
    name: read("name"), schoolYear: read("schoolYear"), major: read("major"),
  };
  const errors: NonNullable<ProfileFormState["errors"]> = {};
  if (!profile.name || profile.name.length > 100) errors.name = "Enter a name between 1 and 100 characters.";
  if (!(SCHOOL_YEARS as readonly string[]).includes(profile.schoolYear)) errors.schoolYear = "Choose your year of schooling.";
  if (!profile.major || profile.major.length > 120) errors.major = "Enter your major (up to 120 characters), or Undeclared.";
  return { profile, errors, valid: Object.keys(errors).length === 0 };
}
