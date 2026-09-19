import "server-only";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { Pool } from "pg";
import { readAuthConfig } from "./auth-config";

export function authOptions(
  config: ReturnType<typeof readAuthConfig>,
  database: BetterAuthOptions["database"],
) {
  return {
    appName: "EAsy",
    baseURL: config.baseURL,
    secret: config.secret,
    database,
    trustedOrigins: [
      config.baseURL,
      ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
      ...(process.env.VERCEL_PROJECT_PRODUCTION_URL ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`] : []),
    ],
    socialProviders: {
      google: {
        clientId: config.googleClientId,
        clientSecret: config.googleClientSecret,
        prompt: "select_account",
        accessType: "online",
        includeGrantedScopes: false,
      },
    },
    user: { modelName: "auth_user" },
    session: {
      modelName: "auth_session",
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    account: {
      modelName: "auth_account",
      encryptOAuthTokens: true,
      accountLinking: { enabled: false },
      storeStateStrategy: "database",
    },
    verification: { modelName: "auth_verification" },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "auth_rate_limit",
      window: 60,
      max: 100,
      customRules: { "/sign-in/social": { window: 60, max: 10 } },
    },
    advanced: {
      disableOriginCheck: false,
      disableCSRFCheck: false,
      cookiePrefix: "easy",
      useSecureCookies: config.production || config.baseURL.startsWith("https:"),
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
    },
    onAPIError: { errorURL: `${config.baseURL}/sign-in?error=oauth` },
  } satisfies BetterAuthOptions;
}

function createAuth() {
  const config = readAuthConfig();
  const pool = new Pool({
    connectionString: config.databaseURL,
    ssl: config.databaseSSL ? { rejectUnauthorized: true } : undefined,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });
  // Avoid printing errors that can include connection details or credentials.
  pool.on("error", () => console.error("Authentication database connection failed"));
  return betterAuth(authOptions(config, pool));
}

// Lazy initialization keeps builds/public pages independent of auth credentials.
const globalAuth = globalThis as typeof globalThis & { easyAuth?: ReturnType<typeof createAuth> };
export function getAuth() {
  return globalAuth.easyAuth ??= createAuth();
}
