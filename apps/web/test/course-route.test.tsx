// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../app/api/courses/[code]/offerings/route";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const request = () => new Request("http://localhost:3000/api/courses/CS%200447/offerings", {
  headers: { cookie: "private-session-cookie", authorization: "private-token" },
});
const context = { params: Promise.resolve({ code: "CS 0447" }) };

describe("same-origin course requests", () => {
  it("returns course results through the web server without forwarding browser credentials", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:4000/");
    const fetch = vi.fn().mockResolvedValue(Response.json({ data: [{ id: "offering-1" }] }));
    vi.stubGlobal("fetch", fetch);
    const response = await GET(request(), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [{ id: "offering-1" }] });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(fetch).toHaveBeenCalledWith("http://localhost:4000/courses/CS%200447/offerings", {
      cache: "no-store", signal: expect.any(AbortSignal),
    });
  });
  it("returns a retryable error when the API connection fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private infrastructure details")));
    const response = await GET(request(), context);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private");
  });
  it("does not expose API error bodies", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private database details", { status: 500 })));
    const response = await GET(request(), context);
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("private");
  });
  it("rejects invalid API responses and oversized course codes", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ unexpected: true }));
    vi.stubGlobal("fetch", fetch);
    expect((await GET(request(), context)).status).toBe(503);
    fetch.mockClear();
    expect((await GET(request(), { params: Promise.resolve({ code: "x".repeat(81) }) })).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});
