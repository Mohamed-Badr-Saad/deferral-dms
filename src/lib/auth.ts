import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";

function splitOrigins(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function requestOrigin(request?: Request) {
  if (!request) return null;

  try {
    return new URL(request.url).origin;
  } catch {
    return null;
  }
}

function forwardedOrigin(request?: Request) {
  if (!request) return null;

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return null;

  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

const staticTrustedOrigins = Array.from(
  new Set(
    [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      process.env.BETTER_AUTH_BASE_URL,
      process.env.BETTER_AUTH_URL,
      process.env.NEXT_PUBLIC_APP_URL,
      ...splitOrigins(process.env.BETTER_AUTH_TRUSTED_ORIGINS),
    ].filter(Boolean) as string[],
  ),
);

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_BASE_URL ?? process.env.BETTER_AUTH_URL,
  trustedOrigins: (request) =>
    Array.from(
      new Set(
        [
          ...staticTrustedOrigins,
          requestOrigin(request),
          forwardedOrigin(request),
        ].filter(Boolean) as string[],
      ),
    ),
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    // DEFAULT: autoSignIn = true (keep it)
  },

  // ✅ sessions: longer expiry so rememberMe is meaningful
  // Better Auth sessions expire after 7 days by default; this sets 30 days. :contentReference[oaicite:3]{index=3}
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh session in DB roughly daily when used
  },

  advanced: {
    database: {
      generateId: "uuid",
    },
  },

  plugins: [nextCookies()],
});
