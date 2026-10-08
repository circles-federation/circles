"use server";

import { ApplicationError, CONFIRM_CODE_MINUTES, confirmApplication, renewConfirmationCode, startApplication, unconfirmedApplicationEmail } from "@/lib/db/applications";
import { sendEmail } from "@/lib/email";
import { applicationCodeEmail } from "@/lib/email/templates.util";
import { sendSms } from "@/lib/sms";
import { phoneCodeText } from "@/lib/sms/messages.util";

/* The Server Actions the public apply page (/apply) calls — no session, since
   the applicant isn't a member yet. Like lib/auth.ts, a result object rather
   than a throw (Next hides a thrown message in production), and the codes
   come back to the browser only outside production, as the page's "dev mode"
   hint: in production the email (and the text, for a number) is the whole
   proof of owning the address. */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// one code per address (and per number) per minute, as for login codes (see
// lib/auth.ts): each is someone's real inbox or phone. In memory, so per
// server process.
const RESEND_COOLDOWN_MS = 60_000;
const lastSent = new Map<string, number>();

function cooldownError(...keys: string[]): string | null {
  const wait = Math.max(...keys.map((k) => RESEND_COOLDOWN_MS - (Date.now() - (lastSent.get(k.trim().toLowerCase()) ?? 0))));
  return wait > 0 ? `A code was just sent — check for it, or try again in ${Math.ceil(wait / 1000)} seconds.` : null;
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

async function textCode(phone: string, code: string): Promise<string | null> {
  try {
    await sendSms({ to: phone, body: phoneCodeText(code, CONFIRM_CODE_MINUTES) });
  } catch (err) {
    console.error("Couldn't text an application code:", err);
    return "We couldn't text you a code — check the number, or try again in a moment.";
  }
  lastSent.set(phone, Date.now());
  return null;
}

const devCode = (code: string, phoneCode: string | null) =>
  process.env.NODE_ENV === "production" ? {} : { code, ...(phoneCode ? { phoneCode } : {}) };

// the form, as FormData since that's how a Server Action takes the photo
export async function submitApplication(form: FormData): Promise<Result<{ id: string; code?: string; phoneCode?: string }>> {
  const field = (name: string) => String(form.get(name) ?? "");
  const photo = form.get("photo");
  const email = field("email");
  const wait = cooldownError(email);
  if (wait) return { ok: false, error: wait };
  try {
    const { id, code, phone, phoneCode } = await startApplication(
      { firstName: field("firstName"), lastName: field("lastName"), email, neighborhoodId: field("neighborhoodId"), address: field("address"), phone: field("phone") },
      photo instanceof Blob ? photo : new Blob(),
      field("agreementVersion")
    );
    if (phone && cooldownError(phone)) return { ok: false, error: cooldownError(phone)! };
    const failed = (await sendCode(email, code)) ?? (phone && phoneCode ? await textCode(phone, phoneCode) : null);
    if (failed) return { ok: false, error: failed };
    return { ok: true, id, ...devCode(code, phoneCode) };
  } catch (err) {
    if (err instanceof ApplicationError) return { ok: false, error: err.message };
    console.error("Couldn't start an application:", err);
    return { ok: false, error: "Something went wrong — try again in a moment." };
  }
}

export async function resendApplicationCode(id: string): Promise<Result<{ code?: string; phoneCode?: string }>> {
  try {
    // before new codes replace the old ones, so a refusal leaves the old ones working
    const wait = cooldownError(await unconfirmedApplicationEmail(id));
    if (wait) return { ok: false, error: wait };
    const { email, code, phone, phoneCode } = await renewConfirmationCode(id);
    const failed = (await sendCode(email, code)) ?? (phone && phoneCode ? await textCode(phone, phoneCode) : null);
    return failed ? { ok: false, error: failed } : { ok: true, ...devCode(code, phoneCode) };
  } catch (err) {
    if (err instanceof ApplicationError) return { ok: false, error: err.message };
    console.error("Couldn't resend an application code:", err);
    return { ok: false, error: "Something went wrong — try again in a moment." };
  }
}

export async function confirmApplicationCode(id: string, code: string, phoneCode?: string): Promise<Result> {
  try {
    await confirmApplication(id, code, phoneCode);
    return { ok: true };
  } catch (err) {
    if (err instanceof ApplicationError) return { ok: false, error: err.message };
    console.error("Couldn't confirm an application:", err);
    return { ok: false, error: "Something went wrong — try again in a moment." };
  }
}
