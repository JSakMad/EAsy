// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readAuthConfig } from "../lib/auth-config";

const valid = {
  BETTER_AUTH_SECRET: "test-only-32-byte-secret-do-not-use-in-production",
  BETTER_AUTH_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "test-client",
  GOOGLE_CLIENT_SECRET: "test-client-secret",
  DATABASE_URL: "postgresql://localhost/easy_auth_test",
};

describe("auth configuration", () => {
  it("allows local HTTP development and normalizes the origin", () => {
    expect(readAuthConfig({ ...valid, BETTER_AUTH_URL: "http://localhost:3000/" }).baseURL)
      .toBe("http://localhost:3000");
  });
  it.each(Object.keys(valid))("rejects missing %s", (key) => {
    expect(() => readAuthConfig({ ...valid, [key]: "" })).toThrow();
  });
  it.each(["short", "YOUR_GENERATED_RANDOM_SECRET________________"])("rejects weak/placeholder secrets", (secret) => {
    expect(() => readAuthConfig({ ...valid, BETTER_AUTH_SECRET: secret })).toThrow();
  });
  it.each(["https://example.com/path", "https://example.com?x=1", "https://user:pass@example.com", "http://example.com"])(
    "rejects unsafe origin %s", (baseURL) => {
      expect(() => readAuthConfig({ ...valid, BETTER_AUTH_URL: baseURL })).toThrow();
    },
  );
  it("requires HTTPS in production", () => {
    expect(() => readAuthConfig({ ...valid, NODE_ENV: "production" })).toThrow();
    expect(readAuthConfig({ ...valid, NODE_ENV: "production", BETTER_AUTH_URL: "https://easy.example" }).production).toBe(true);
  });
  it("rejects unsupported database settings", () => {
    expect(() => readAuthConfig({ ...valid, DATABASE_URL: "https://example.com" })).toThrow();
    expect(() => readAuthConfig({ ...valid, DATABASE_SSL: "yes" })).toThrow();
  });
});
