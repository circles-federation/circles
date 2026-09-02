"use server";

import { cookies } from "next/headers";
import { getMemberByEmail } from "@/lib/db/members";

// Must match lib/session.ts's SESSION_COOKIE.
const SESSION_COOKIE = "session";
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface AuthResult {
  ok: boolean;
  error?: string;
}

interface RequestCodeResult extends AuthResult {
  code?: string;
}

/* Mock, in-memory pending-code store — email -> { code, expiresAt }. There's
   no real email provider yet, so requestLoginCode() hands the code straight
   back to the caller instead of sending it; the welcome page shows it as an
   explicit "dev mode" hint. This whole file is throwaway scaffolding for the
   mock-auth phase: the cookie below is deliberately unsigned, and this Map
   won't survive a server restart or work across multiple server instances —
   both are fine for a prototype and both go away once a real auth provider
   (most likely Supabase Auth, given its own signInWithOtp/verifyOtp flow this
   was modeled after) replaces this file's internals.

   Every export here is a Server Action ("use server" above applies to the
   whole file) — getCurrentUserId() deliberately does NOT live in this file:
   it's a plain helper only ever called from a Server Component, and mixing
   it in here broke importing these actions from the Client Component welcome
   page (Next tries to bundle the whole module, including next/headers, for
   the client). See lib/session.ts. */
const pendingCodes = new Map<string, { code: string; expiresAt: number }>();

export async function requestLoginCode(email: string): Promise<RequestCodeResult> {
  const member = await getMemberByEmail(email);
  if (!member) {
    return { ok: false, error: "We don't recognize that email yet." };
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  pendingCodes.set(email.trim().toLowerCase(), { code, expiresAt: Date.now() + CODE_TTL_MS });
  return { ok: true, code };
}

export async function verifyLoginCode(email: string, code: string): Promise<AuthResult> {
  const key = email.trim().toLowerCase();
  const pending = pendingCodes.get(key);
  if (!pending || pending.expiresAt < Date.now()) {
    return { ok: false, error: "That code has expired — request a new one." };
  }
  if (pending.code !== code.trim()) {
    return { ok: false, error: "That code doesn't match." };
  }
  const member = await getMemberByEmail(email);
  if (!member) {
    return { ok: false, error: "We don't recognize that email yet." };
  }
  pendingCodes.delete(key);
  const store = await cookies();
  store.set(SESSION_COOKIE, String(member.id), { httpOnly: true, sameSite: "lax", path: "/" });
  return { ok: true };
}

export async function logout(): Promise<AuthResult> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  return { ok: true };
}
