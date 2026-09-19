// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { makeSignature } from "better-auth/crypto";
import { authOptions } from "../lib/auth";
import { readAuthConfig } from "../lib/auth-config";

vi.mock("server-only", () => ({}));
const config = readAuthConfig({
  BETTER_AUTH_SECRET: "test-only-32-byte-secret-do-not-use-in-production",
  BETTER_AUTH_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "fixture-client", GOOGLE_CLIENT_SECRET: "fixture-secret",
  DATABASE_URL: "postgresql://localhost/easy_auth_test",
});

function createTestAuth() {
  const db = { auth_user: [], auth_session: [], auth_account: [], auth_verification: [], auth_rate_limit: [] };
  return betterAuth({ ...authOptions(config, memoryAdapter(db)), logger: { disabled: true } });
}
let auth: ReturnType<typeof createTestAuth>;
beforeEach(() => { auth = createTestAuth(); });

async function seedSession(expired = false) {
  const context = await auth.$context;
  const user = await context.internalAdapter.createUser({
    name: "Fixture Student", email: "student@example.test", emailVerified: true,
  }, { method: "oauth", oauth: { providerId: "google", profile: {} } });
  const session = await context.internalAdapter.createSession(user.id);
  if (expired) await context.adapter.update({ model: "session", where: [{ field: "id", value: session.id }], update: {
    expiresAt: new Date(Date.now() - 1000),
  } });
  const signature = await makeSignature(session.token, config.secret);
  const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${session.token}.${signature}`)}`;
  return { cookie, user, session };
}

describe("real Better Auth session lifecycle (isolated memory adapter)", () => {
  it("rejects missing and forged cookies", async () => {
    expect(await auth.api.getSession({ headers: new Headers() })).toBeNull();
    expect(await auth.api.getSession({ headers: new Headers({ cookie: "easy.session_token=forged" }) })).toBeNull();
  });
  it("loads a persisted user from a valid signed session", async () => {
    const { cookie, user } = await seedSession();
    const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
    expect(session?.user.id).toBe(user.id);
  });
  it("rejects an expired database session even with a correctly signed cookie", async () => {
    const { cookie } = await seedSession(true);
    expect(await auth.api.getSession({ headers: new Headers({ cookie }) })).toBeNull();
  });
  it("revokes the database session on sign-out and clears the cookie", async () => {
    const { cookie } = await seedSession();
    const response = await auth.handler(new Request(`${config.baseURL}/api/auth/sign-out`, {
      method: "POST", headers: { cookie, origin: config.baseURL, "content-type": "application/json" }, body: "{}",
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(await auth.api.getSession({ headers: new Headers({ cookie }) })).toBeNull();
  });
  it("rejects cross-origin sign-out without revoking the session", async () => {
    const { cookie } = await seedSession();
    const response = await auth.handler(new Request(`${config.baseURL}/api/auth/sign-out`, {
      method: "POST", headers: { cookie, origin: "https://attacker.example", "content-type": "application/json" }, body: "{}",
    }));
    expect(response.status).toBe(403);
    expect(await auth.api.getSession({ headers: new Headers({ cookie }) })).not.toBeNull();
  });
  it("rejects an OAuth callback without valid state", async () => {
    const response = await auth.handler(new Request(`${config.baseURL}/api/auth/callback/google?code=fake&state=fake`));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/sign-in");
    expect(response.headers.get("set-cookie") ?? "").not.toContain("easy.session_token=");
  });
  it("does not expose email/password registration", async () => {
    const response = await auth.handler(new Request(`${config.baseURL}/api/auth/sign-up/email`, {
      method: "POST", headers: { origin: config.baseURL, "content-type": "application/json" },
      body: JSON.stringify({ name: "Student", email: "test@example.test", password: "irrelevant-password" }),
    }));
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
