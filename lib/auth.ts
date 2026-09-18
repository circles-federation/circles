"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/better-auth";
import { getMemberByEmail } from "@/lib/db/members";

interface AuthResult {
  ok: boolean;
  error?: string;
}

interface RequestCodeResult extends AuthResult {
  code?: string;
}

/* Real auth now — Better Auth's email-otp plugin, see lib/better-auth.ts —
   wrapped behind this file's existing exports so no call site changes
   (welcome.page.tsx, app/(app)/layout.tsx via lib/session.ts). There's still
   no real email provider, so requestLoginCode() reads the OTP straight back
   out via auth.api.getVerificationOTP() (a Better Auth endpoint marked
   serverOnly — never exposed over HTTP) instead of actually emailing it; the
   welcome page still shows it as an explicit "dev mode" hint, same as before.

   getMemberByEmail() gates requestLoginCode() the same way it always did:
   Better Auth's own disableSignUp option silently no-ops (returns success)
   rather than erroring for an unrecognized email, specifically to avoid
   leaking which emails are registered — so this app-level check is what
   actually produces the "we don't recognize that email yet" message. */

export async function requestLoginCode(email: string): Promise<RequestCodeResult> {
  const member = await getMemberByEmail(email);
  if (!member) {
    return { ok: false, error: "We don't recognize that email yet." };
  }
  await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });
  const { otp } = await auth.api.getVerificationOTP({ query: { email, type: "sign-in" } });
  return { ok: true, code: otp ?? undefined };
}

export async function verifyLoginCode(email: string, code: string): Promise<AuthResult> {
  try {
    await auth.api.signInEmailOTP({ body: { email, otp: code.trim() } });
  } catch {
    // Better Auth uses the same INVALID_OTP error for a wrong code, an
    // expired one, and disableSignUp rejecting an unrecognized email — no
    // finer-grained reason to surface here than the mock had.
    return { ok: false, error: "That code doesn't match, or has expired — request a new one." };
  }
  return { ok: true };
}

export async function logout(): Promise<AuthResult> {
  await auth.api.signOut({ headers: await headers() });
  return { ok: true };
}
