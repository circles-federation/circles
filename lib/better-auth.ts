import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins/email-otp";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db/client";
import * as schema from "./db/schema";

/* The only file that imports "better-auth" — lib/auth.ts/lib/session.ts wrap
   this behind the app's existing requestLoginCode/verifyLoginCode/logout/
   getCurrentUserId seam (see the wrapping rule in the plan), so no component
   or route ever needs to know Better Auth exists.

   Email OTP only, no password auth (this app has never had one) — and
   disableSignUp because this app doesn't create accounts on sign-in; a
   member without a matching seeded email should get the same "we don't
   recognize that email yet" rejection the old mock auth gave, not a new
   account. otpLength/expiresIn match the mock's old 6-digit/10-minute code.
   sendVerificationOTP preserves the existing "no real email provider yet"
   dev-mode-hint behavior — see lib/auth.ts's requestLoginCode. */
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
      expiresIn: 600,
      disableSignUp: true,
      async sendVerificationOTP({ otp }) {
        // no real email provider — lib/auth.ts's requestLoginCode() reads
        // the OTP back out via getVerificationOTP() and hands it to the
        // welcome page as an explicit dev-mode hint, same as the old mock
        void otp;
      },
    }),
    // must be last — forwards Set-Cookie headers from auth.api.* calls made
    // inside a Next.js Server Action via next/headers' cookies(), which is
    // what lets lib/auth.ts call auth.api.* directly with no client-side
    // authClient and no mounted catch-all route handler
    nextCookies(),
  ],
});
