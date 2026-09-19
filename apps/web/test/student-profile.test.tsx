// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(), getSession: vi.fn(), getProfile: vi.fn(), save: vi.fn(), revalidate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({ requireSession: mocks.requireSession, getSession: mocks.getSession }));
vi.mock("@/lib/student-profile", () => ({ getStudentProfile: mocks.getProfile, saveStudentProfile: mocks.save }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`Redirect: ${path}`); } }));
import { saveProfile } from "../app/account/setup/actions";
import { checkStudentSetup, requireStudentProfile } from "../lib/profile-access";
import { validateProfile } from "../lib/profile-fields";

function form(values: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ name: " Alex Student ", schoolYear: "Second year", major: "Computer Science", preferencesReviewed: "1", ...values })) data.set(key, value);
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireSession.mockResolvedValue({ user: { id: "signed-in-user" } });
});

describe("profile form validation and authorization", () => {
  it('validates preferences and distinguishes an empty selection from unfinished setup', () => {
    expect(validateProfile(form({ preferencesReviewed: '' })).valid).toBe(false);
    expect(validateProfile(form({ preferences: 'forged-preference' })).valid).toBe(false);
    const data = form();
    data.append('preferences', 'online_quizzes');
    data.append('preferences', 'online_classes');
    data.append('preferences', 'online_quizzes');
    expect(validateProfile(data).profile.preferences).toEqual(['online_quizzes', 'online_classes']);
    expect(validateProfile(form()).profile.preferences).toEqual([]);
  });
  it("rejects blank, oversized, and unsupported values", () => {
    const invalid: Record<string, string>[] = [{ name: "   " }, { major: "   " }, { schoolYear: "forged" }, { name: "x".repeat(101) }, { major: "x".repeat(121) }];
    for (const values of invalid) {
      expect(validateProfile(form(values)).valid).toBe(false);
    }
  });
  it("accepts Unicode names and Undeclared majors", () => {
    expect(validateProfile(form({ name: "  李  明  ", major: "Undeclared" })).profile.name).toBe("李 明");
    expect(validateProfile(form({ major: "Undeclared" })).valid).toBe(true);
  });
  it("does not write invalid submissions", async () => {
    expect(await saveProfile({}, form({ major: "" }))).toHaveProperty("errors.major");
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated submission before writing", async () => {
    mocks.requireSession.mockRejectedValue(new Error("Redirect: /sign-in"));
    await expect(saveProfile({}, form())).rejects.toThrow("Redirect: /sign-in");
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("saves only to the session owner, ignoring a submitted user ID", async () => {
    await expect(saveProfile({}, form({ userId: "someone-else" }))).rejects.toThrow("Redirect: /account");
    expect(mocks.save).toHaveBeenCalledWith("signed-in-user", { name: "Alex Student", schoolYear: "Second year", major: "Computer Science", preferences: [] });
    expect(mocks.revalidate).toHaveBeenCalledWith("/", "layout");
  });
  it("returns a retry message without exposing database errors", async () => {
    mocks.save.mockRejectedValue(new Error("private connection string"));
    const result = await saveProfile({}, form());
    expect(result.message).toContain("try again");
    expect(JSON.stringify(result)).not.toContain("private");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});

describe("required student setup", () => {
  it("asks existing students to review preferences once", async () => {
    mocks.getProfile.mockResolvedValue({ name: 'Student', schoolYear: 'First year', major: 'Undeclared', preferences: null });
    await expect(requireStudentProfile()).rejects.toThrow('Redirect: /account/setup');
  });
  it("redirects existing accounts without a profile", async () => {
    mocks.getProfile.mockResolvedValue(null);
    await expect(requireStudentProfile()).rejects.toThrow("Redirect: /account/setup");
  });
  it("allows completed accounts and uses their saved profile", async () => {
    const profile = { name: "Student", schoolYear: "First year", major: "Undeclared", preferences: [] };
    mocks.getProfile.mockResolvedValue(profile);
    expect((await requireStudentProfile()).profile).toEqual(profile);
    expect(mocks.getProfile).toHaveBeenCalledWith("signed-in-user");
  });
  it("allows anonymous browsing without a profile query", async () => {
    mocks.getSession.mockResolvedValue(null);
    await checkStudentSetup();
    expect(mocks.getProfile).not.toHaveBeenCalled();
  });
  it("blocks signed-in browsing until setup is complete", async () => {
    mocks.getSession.mockResolvedValue({ user: { id: "incomplete-user" } });
    mocks.getProfile.mockResolvedValue(null);
    await expect(checkStudentSetup()).rejects.toThrow("Redirect: /account/setup");
    expect(mocks.getProfile).toHaveBeenCalledWith("incomplete-user");
  });
});
