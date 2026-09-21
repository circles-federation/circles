import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins/email-otp";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db/client";
import * as schema from "./db/schema";
import { LOGIN_CODE_MINUTES } from "./email/templates.util";

/* The only file that imports "better-auth" — lib/auth.ts/lib/session.ts wrap
   this behind the app's existing requestLoginCode/verifyLoginCode/logout/
   getCurrentUserId seam (see the wrapping rule in the plan), so no component
   or route ever needs to know Better Auth exists.

   Email OTP only, no password auth (this app has never had one) — and
   disableSignUp because this app doesn't create accounts on sign-in; a
   member without a matching seeded email should get the same "we don't
   recognize that email yet" rejection the old mock auth gave, not a new
   account. The code is 6 digits and lives LOGIN_CODE_MINUTES (the email says
   so too); Better Auth's own default of 3 wrong tries per code stays.
   sendVerificationOTP does nothing on purpose: Better Auth runs it as a
   background task and swallows any error from it, so a failed send would look
   like success. lib/auth.ts's requestLoginCode() emails the code itself and
   can report a failure. */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: { enabled: false },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: LOGIN_CODE_MINUTES * 60,
      disableSignUp: true,
      async sendVerificationOTP() {},
    }),
    // must be last — forwards Set-Cookie headers from auth.api.* calls made
    // inside a Next.js Server Action via next/headers' cookies(), which is
    // what lets lib/auth.ts call auth.api.* directly with no client-side
    // authClient and no mounted catch-all route handler
    nextCookies(),
  ],
});
