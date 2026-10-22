"use server";

import { cookies } from "next/headers";
import { cancelGuestRsvp, confirmGuestRsvp, GUEST_CODE_MINUTES, GuestRsvpError, renewGuestCode, startGuestRsvp } from "@/lib/db/guest-rsvps";
import { sendEmail } from "@/lib/email";
import { guestRsvpCodeEmail } from "@/lib/email/templates.util";
import { GUEST_COOKIE, guestIdsFrom } from "@/lib/guest-rsvp.util";

/* The Server Actions the public event page (/e/[token]) calls to RSVP without
   an account — no session. Like lib/apply.ts, a result object rather than a
   throw, and the emailed code comes back to the browser only outside
   production, as the dialog's "dev mode" hint. A confirmed RSVP is remembered
   in a cookie holding its (unguessable) id, which is also what lets the guest
   take it back. */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const devCode = (code: string) => (process.env.NODE_ENV === "production" ? {} : { code });

async function sendCode(to: string, code: string, eventTitle: string): Promise<string | null> {
  try {
    await sendEmail({ to, ...guestRsvpCodeEmail(code, GUEST_CODE_MINUTES, eventTitle) });
    return null;
  } catch (err) {
    console.error("Couldn't send an RSVP code:", err);
    return "We couldn't email you a code — check the address, or try again in a moment.";
  }
}

function failure(err: unknown, what: string): { ok: false; error: string } {
  if (err instanceof GuestRsvpError) return { ok: false, error: err.message };
  console.error(`Couldn't ${what}:`, err);
  return { ok: false, error: "Something went wrong — try again in a moment." };
}

export async function startGuestRsvpAction(token: string, name: string, email: string): Promise<Result<{ id: string; code?: string }>> {
  try {
    const started = await startGuestRsvp(token, name, email);
    const failed = await sendCode(started.email, started.code, started.eventTitle);
    return failed ? { ok: false, error: failed } : { ok: true, id: started.id, ...devCode(started.code) };
  } catch (err) {
    return failure(err, "start a guest RSVP");
  }
}

export async function resendGuestRsvpCodeAction(id: string): Promise<Result<{ code?: string }>> {
  try {
    const renewed = await renewGuestCode(id);
    const failed = await sendCode(renewed.email, renewed.code, renewed.eventTitle);
    return failed ? { ok: false, error: failed } : { ok: true, ...devCode(renewed.code) };
  } catch (err) {
    return failure(err, "resend a guest RSVP code");
  }
}

export async function confirmGuestRsvpAction(id: string, code: string): Promise<Result> {
  try {
    await confirmGuestRsvp(id, code);
    const jar = await cookies();
    const ids = [id, ...guestIdsFrom(jar.get(GUEST_COOKIE)?.value).filter((x) => x !== id)].slice(0, 20);
    jar.set(GUEST_COOKIE, ids.join(","), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365, path: "/" });
    return { ok: true };
  } catch (err) {
    return failure(err, "confirm a guest RSVP");
  }
}

// only an RSVP this browser holds the id of can be taken back
export async function cancelGuestRsvpAction(id: string): Promise<Result> {
  try {
    const jar = await cookies();
    const ids = guestIdsFrom(jar.get(GUEST_COOKIE)?.value);
    if (!ids.includes(id)) return { ok: false, error: "That RSVP isn't from this browser." };
    await cancelGuestRsvp(id);
    jar.set(GUEST_COOKIE, ids.filter((x) => x !== id).join(","), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365, path: "/" });
    return { ok: true };
  } catch (err) {
    return failure(err, "cancel a guest RSVP");
  }
}
