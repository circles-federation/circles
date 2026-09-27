"use server";

import { ApplicationError, CONFIRM_CODE_MINUTES, confirmApplication, renewConfirmationCode, startApplication, unconfirmedApplicationEmail } from "@/lib/db/applications";
import { sendEmail } from "@/lib/email";
import { applicationCodeEmail } from "@/lib/email/templates.util";

/* The Server Actions the public apply page (/apply) calls — no session, since
   the applicant isn't a member yet. Like lib/auth.ts, a result object rather
   than a throw (Next hides a thrown message in production), and the emailed
   code comes back to the browser only outside production, as the page's "dev
   mode" hint: in production the email is the whole proof of owning the
   address. */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// one code per address per minute, as for login codes (see lib/auth.ts): the
// address is someone's real inbox. In memory, so per server process.
const RESEND_COOLDOWN_MS = 60_000;
const lastSent = new Map<string, number>();

function cooldownError(email: string): string | null {
  const wait = RESEND_COOLDOWN_MS - (Date.now() - (lastSent.get(email.trim().toLowerCase()) ?? 0));
  return wait > 0 ? `A code was just sent — check your inbox, or try again in ${Math.ceil(wait / 1000)} seconds.` : null;
}

async function sendCode(email: string, code: string): Promise<string | null> {
  try {
    await sendEmail({ to: email, ...applicationCodeEmail(code, CONFIRM_CODE_MINUTES) });
  } catch (err) {
    console.error("Couldn't send an application code:", err);
    return "We couldn't email you a code — check the address, or try again in a moment.";
  }
  lastSent.set(email.trim().toLowerCase(), Date.now());
  return null;
}

const devCode = (code: string) => (process.env.NODE_ENV === "production" ? {} : { code });

// the form, as FormData since that's how a Server Action takes the photo
export async function submitApplication(form: FormData): Promise<Result<{ id: string; code?: string }>> {
  const field = (name: string) => String(form.get(name) ?? "");
  const photo = form.get("photo");
  const email = field("email");
  const wait = cooldownError(email);
  if (wait) return { ok: false, error: wait };
  try {
    const { id, code } = await startApplication(
      { firstName: field("firstName"), lastName: field("lastName"), email, neighborhoodId: field("neighborhoodId"), address: field("address") },
      photo instanceof Blob ? photo : new Blob()
    );
    const failed = await sendCode(email, code);
    if (failed) return { ok: false, error: failed };
    return { ok: true, id, ...devCode(code) };
  } catch (err) {
    if (err instanceof ApplicationError) return { ok: false, error: err.message };
    console.error("Couldn't start an application:", err);
    return { ok: false, error: "Something went wrong — try again in a moment." };
  }
}

export async function resendApplicationCode(id: string): Promise<Result<{ code?: string }>> {
  try {
    // before a new code replaces the old one, so a refusal leaves the old one working
    const wait = cooldownError(await unconfirmedApplicationEmail(id));
    if (wait) return { ok: false, error: wait };
    const { email, code } = await renewConfirmationCode(id);
    const failed = await sendCode(email, code);
    return failed ? { ok: false, error: failed } : { ok: true, ...devCode(code) };
  } catch (err) {
    if (err instanceof ApplicationError) return { ok: false, error: err.message };
    console.error("Couldn't resend an application code:", err);
    return { ok: false, error: "Something went wrong — try again in a moment." };
  }
}

export async function confirmApplicationCode(id: string, code: string): Promise<Result> {
  try {
    await confirmApplication(id, code);
    return { ok: true };
  } catch (err) {
    if (err instanceof ApplicationError) return { ok: false, error: err.message };
    console.error("Couldn't confirm an application:", err);
    return { ok: false, error: "Something went wrong — try again in a moment." };
  }
}
