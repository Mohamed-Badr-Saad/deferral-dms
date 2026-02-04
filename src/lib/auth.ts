import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET!,
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
