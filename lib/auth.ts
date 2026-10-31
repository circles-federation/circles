"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/better-auth";
import { getMemberByEmail } from "@/lib/db/members";
import { sendEmail } from "@/lib/email";
import { loginCodeEmail } from "@/lib/email/templates.util";

interface AuthResult {
  ok: boolean;
  error?: string;
}

interface RequestCodeResult extends AuthResult {
  // only ever set outside production — see requestLoginCode
  code?: string;
}

// one code per address per minute: the address is a member's real inbox, so
// without this anyone could flood it. In memory, so per server process — fine
// for a single instance; move it to the database if this ever scales out.
const RESEND_COOLDOWN_MS = 60_000;
const lastSent = new Map<string, number>();

/* Real auth now — Better Auth's email-otp plugin, see lib/better-auth.ts —
   wrapped behind this file's existing exports so no call site changes
   (welcome.page.tsx, app/(app)/layout.tsx via lib/session.ts). Better Auth
   creates and stores the code; requestLoginCode() reads it back out via
   auth.api.getVerificationOTP() (a Better Auth endpoint marked serverOnly —
   never exposed over HTTP) and emails it itself through lib/email, rather than
   from Better Auth's sendVerificationOTP hook, which swallows errors (see
   lib/better-auth.ts). Outside production the code is also returned so the
   welcome page can show it as an explicit "dev mode" hint; in production it
   is never returned to the browser, since the email is the whole proof of
   owning the address.

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
  const key = email.trim().toLowerCase();
  const wait = RESEND_COOLDOWN_MS - (Date.now() - (lastSent.get(key) ?? 0));
  if (wait > 0) {
    return { ok: false, error: `A code was just sent — check your inbox, or try again in ${Math.ceil(wait / 1000)} seconds.` };
  }
  let otp: string | null;
  try {
    await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });
    ({ otp } = await auth.api.getVerificationOTP({ query: { email, type: "sign-in" } }));
    if (!otp) throw new Error("no code was stored");
    await sendEmail({ to: email, ...loginCodeEmail(otp) });
  } catch (err) {
    console.error("Couldn't send a login code:", err);
    return { ok: false, error: "We couldn't send your code — try again in a moment." };
  }
  lastSent.set(key, Date.now());
  return process.env.NODE_ENV === "production" ? { ok: true } : { ok: true, code: otp };
}

export async function verifyLoginCode(email: string, code: string): Promise<AuthResult> {
  try {
    // the headers are how the session records the browser and address it was made from
    await auth.api.signInEmailOTP({ body: { email, otp: code.trim() }, headers: await headers() });
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
