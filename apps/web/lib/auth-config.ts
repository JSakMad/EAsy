type Environment = Record<string, string | undefined>;

export function readAuthConfig(env: Environment = process.env) {
  const required = (name: string) => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`Missing ${name}`);
    return value;
  };
  const secret = required("BETTER_AUTH_SECRET");
  if (secret.length < 32 || /YOUR_|replace.with|change.me/i.test(secret)) {
    throw new Error("BETTER_AUTH_SECRET must be a generated secret of at least 32 characters");
  }
  const url = new URL(required("BETTER_AUTH_URL"));
  const production = env.NODE_ENV === "production";
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && !production &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))) {
    throw new Error("BETTER_AUTH_URL must be an HTTPS origin (HTTP localhost is allowed in development)");
  }
  const databaseURL = required("DATABASE_URL");
  if (!["postgres:", "postgresql:"].includes(new URL(databaseURL).protocol)) {
    throw new Error("DATABASE_URL must use PostgreSQL");
  }
  if (env.DATABASE_SSL && !["true", "false"].includes(env.DATABASE_SSL)) {
    throw new Error("DATABASE_SSL must be true or false");
  }
  return {
    secret, baseURL: url.origin, databaseURL, production,
    databaseSSL: env.DATABASE_SSL === "true",
    googleClientId: required("GOOGLE_CLIENT_ID"),
    googleClientSecret: required("GOOGLE_CLIENT_SECRET"),
  };
}

export function isAuthConfigured() {
  try { readAuthConfig(); return true; } catch { return false; }
}
