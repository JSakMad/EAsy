// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ configured: vi.fn(), getSession: vi.fn(), handler: vi.fn(), redirect: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth-config", () => ({ isAuthConfigured: mocks.configured }));
vi.mock("@/lib/auth", () => ({ getAuth: () => ({ api: { getSession: mocks.getSession }, handler: mocks.handler }) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: "test-cookie" }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { requireSession } from "../lib/session";
import { GET, POST } from "../app/api/auth/[...all]/route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.configured.mockReturnValue(true);
  mocks.redirect.mockImplementation((path) => { throw new Error(`Redirect: ${path}`); });
});

describe("server account protection", () => {
  it("redirects unauthenticated requests", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(requireSession()).rejects.toThrow("Redirect: /sign-in");
  });
  it("validates incoming headers on the server", async () => {
    const session = { user: { id: "user-1" } };
    mocks.getSession.mockResolvedValue(session);
    expect(await requireSession()).toEqual(session);
    expect(mocks.getSession.mock.calls[0]![0].headers.get("cookie")).toBe("test-cookie");
  });
  it("does not grant access if the database fails", async () => {
    mocks.getSession.mockRejectedValue(new Error("database unavailable"));
    await expect(requireSession()).rejects.toThrow("database unavailable");
  });
  it("redirects without querying an unconfigured database", async () => {
    mocks.configured.mockReturnValue(false);
    await expect(requireSession()).rejects.toThrow("Redirect: /sign-in");
    expect(mocks.getSession).not.toHaveBeenCalled();
  });
});

describe("auth routes", () => {
  it("fails safely when disabled", async () => {
    mocks.configured.mockReturnValue(false);
    const response = await POST(new Request("http://localhost:3000/api/auth/sign-in/social", { method: "POST" }));
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.handler).not.toHaveBeenCalled();
  });
  it("preserves redirects and session cookies from the auth library", async () => {
    mocks.handler.mockResolvedValue(new Response(null, { status: 302, headers: {
      Location: "/account", "Set-Cookie": "session=fixture; HttpOnly",
    } }));
    const response = await GET(new Request("http://localhost:3000/api/auth/callback/google"));
    expect(response.status).toBe(302);
    expect(response.headers.get("Set-Cookie")).toContain("HttpOnly");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("does not expose connection details on unexpected errors", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mocks.handler.mockRejectedValue(new Error("postgres://private:secret@db"));
      const response = await GET(new Request("http://localhost:3000/api/auth/get-session"));
      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain("secret");
      expect(log).toHaveBeenCalledWith("Authentication request failed");
    } finally { log.mockRestore(); }
  });
});
