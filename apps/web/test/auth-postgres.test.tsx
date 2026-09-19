// @vitest-environment node
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { authOptions } from "../lib/auth";
import { readAuthConfig } from "../lib/auth-config";
import { getStudentProfile, saveStudentProfile } from "../lib/student-profile";

vi.mock("server-only", () => ({}));
const databaseURL = process.env.AUTH_TEST_DATABASE_URL;
if (databaseURL) {
  const url = new URL(databaseURL);
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || !url.pathname.endsWith("_test")) {
    throw new Error("Auth integration tests require a localhost database ending in _test");
  }
}
const schema = `auth_test_${randomUUID().replaceAll("-", "")}`;
const pool = new Pool({ connectionString: databaseURL, options: `-c search_path=${schema}`, max: 2 });
const admin = new Pool({ connectionString: databaseURL, max: 1 });
const config = readAuthConfig({
  DATABASE_URL: databaseURL ?? "postgresql://localhost/easy_auth_test",
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "isolated-fixture-secret-do-not-use-in-production",
  GOOGLE_CLIENT_ID: "fixture-client", GOOGLE_CLIENT_SECRET: "fixture-secret",
});
let created = false;

describe.skipIf(!databaseURL)("PostgreSQL auth migration and OAuth lifecycle", () => {
  beforeAll(async () => {
    await admin.query(`CREATE SCHEMA ${schema}`);
    created = true;
    const migration = await readFile(new URL("../../../database/migrations/007_auth_accounts.sql", import.meta.url), "utf8");
    await pool.query(migration);
    await pool.query(await readFile(new URL("../../../database/migrations/008_student_profiles.sql", import.meta.url), "utf8"));
    vi.stubGlobal("easyProfilePool", pool);
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    await pool.end();
    // Only remove the generated schema created by this test, never public data.
    if (created && /^auth_test_[a-f0-9]{32}$/.test(schema)) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  });

  it("matches the installed Better Auth schema", async () => {
    const plan = await getMigrations(authOptions(config, pool));
    expect(plan.toBeCreated).toEqual([]);
    expect(plan.toBeAdded).toEqual([]);
    expect(plan.schemaProblems).toEqual([]);
  });

  it("persists student details, updates names atomically, and deletes profiles with accounts", async () => {
    const id = randomUUID();
    await pool.query('INSERT INTO auth_user (id, name, email) VALUES ($1, $2, $3)', [id, "Google Name", "profile@example.test"]);
    expect(await getStudentProfile(id)).toBeNull();
    const profile = { name: "Chosen Name", schoolYear: "Third year", major: "Computer Science" };
    await saveStudentProfile(id, profile);
    expect(await getStudentProfile(id)).toEqual(profile);
    expect((await pool.query('SELECT name FROM auth_user WHERE id = $1', [id])).rows[0].name).toBe("Chosen Name");
    await expect(saveStudentProfile(id, { ...profile, name: "Bad update", schoolYear: "invalid" })).rejects.toThrow();
    expect(await getStudentProfile(id)).toEqual(profile);
    expect((await pool.query('SELECT name FROM auth_user WHERE id = $1', [id])).rows[0].name).toBe("Chosen Name");
    await saveStudentProfile(id, { ...profile, schoolYear: "Fourth year" });
    expect((await getStudentProfile(id))?.schoolYear).toBe("Fourth year");
    expect(await getStudentProfile("another-user")).toBeNull();
    await pool.query('DELETE FROM auth_user WHERE id = $1', [id]);
    expect(await getStudentProfile(id)).toBeNull();
  });

  it("creates and reuses an OAuth identity, encrypts tokens, and revokes sessions", async () => {
    const auth = betterAuth({ ...authOptions(config, pool), logger: { disabled: true } });
    const context = await auth.$context;
    const google = context.socialProviders.find((provider) => provider.id === "google")!;
    // Only the Google network boundary is mocked. State, PKCE, callback handling,
    // account creation, SQL persistence, signed cookies and revocation are real.
    vi.spyOn(google, "validateAuthorizationCode").mockResolvedValue({
      accessToken: "synthetic-access-token", refreshToken: "synthetic-refresh-token",
    });
    vi.spyOn(google, "getUserInfo").mockResolvedValue({
      user: { name: "Fixture Student", email: "fixture@example.test", emailVerified: true },
      data: { sub: "google-fixture-1", email: "fixture@example.test", email_verified: true },
    });

    async function signIn() {
      const start = await auth.handler(new Request(`${config.baseURL}/api/auth/sign-in/social`, {
        method: "POST", headers: { origin: config.baseURL, "content-type": "application/json", "x-forwarded-for": "127.0.0.1" },
        body: JSON.stringify({ provider: "google", callbackURL: "/account" }),
      }));
      expect(start.status).toBe(200);
      const authorization = new URL((await start.json()).url);
      expect(authorization.searchParams.get("code_challenge")).toBeTruthy();
      expect(authorization.searchParams.get("redirect_uri")).toBe(`${config.baseURL}/api/auth/callback/google`);
      const state = authorization.searchParams.get("state")!;
      const stateCookies = start.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
      const callback = await auth.handler(new Request(`${config.baseURL}/api/auth/callback/google?code=synthetic&state=${encodeURIComponent(state)}`, {
        headers: { cookie: stateCookies },
      }));
      expect(callback.status).toBe(302);
      expect(callback.headers.get("location")).toBe("/account");
      const cookies = callback.headers.getSetCookie();
      const sessionCookie = cookies.find((cookie) => cookie.startsWith("easy.session_token="))!;
      expect(sessionCookie).toContain("HttpOnly");
      expect(sessionCookie).toContain("SameSite=Lax");
      return sessionCookie.split(";")[0]!;
    }

    const firstCookie = await signIn();
    const firstSession = await auth.api.getSession({ headers: new Headers({ cookie: firstCookie }) });
    expect(firstSession?.user.email).toBe("fixture@example.test");
    const secondCookie = await signIn();
    const secondSession = await auth.api.getSession({ headers: new Headers({ cookie: secondCookie }) });
    expect(secondSession?.user.id).toBe(firstSession?.user.id);
    expect((await pool.query("SELECT count(*)::int AS count FROM auth_user")).rows[0].count).toBe(1);
    const accounts = await pool.query('SELECT "accessToken", "refreshToken" FROM auth_account');
    expect(accounts.rowCount).toBe(1);
    expect(accounts.rows[0].accessToken).not.toContain("synthetic-access-token");
    expect(accounts.rows[0].refreshToken).not.toContain("synthetic-refresh-token");
    expect((await pool.query("SELECT count(*)::int AS count FROM auth_rate_limit")).rows[0].count).toBeGreaterThan(0);

    const signOut = await auth.handler(new Request(`${config.baseURL}/api/auth/sign-out`, {
      method: "POST", headers: { cookie: firstCookie, origin: config.baseURL, "content-type": "application/json" }, body: "{}",
    }));
    expect(signOut.status).toBe(200);
    expect(await auth.api.getSession({ headers: new Headers({ cookie: firstCookie }) })).toBeNull();
    expect(await auth.api.getSession({ headers: new Headers({ cookie: secondCookie }) })).not.toBeNull();

    await pool.query('UPDATE auth_session SET "expiresAt" = now() - interval \'1 second\'');
    expect(await auth.api.getSession({ headers: new Headers({ cookie: secondCookie }) })).toBeNull();
    await pool.query("DELETE FROM auth_user WHERE id = $1", [firstSession!.user.id]);
    expect((await pool.query("SELECT count(*)::int AS count FROM auth_account")).rows[0].count).toBe(0);
  });
});
