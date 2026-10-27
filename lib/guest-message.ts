"use server";

import { after } from "next/server";
import { takeAllowance } from "@/lib/code-allowance";
import { UserFacingError } from "@/lib/db/errors";
import { confirmGuestMessage, GUEST_MESSAGE_CODE_MINUTES, renewGuestMessageCode, startGuestMessage } from "@/lib/db/guest-messages";
import { sendEmail } from "@/lib/email";
import { guestMessageCodeEmail } from "@/lib/email/templates.util";
import { validateGuest } from "@/lib/guest-rsvp.util";
import { validateMessage, type MessageInput } from "@/lib/messages.util";
import { tellCircleOfMessage } from "@/lib/notify";

/* The Server Actions a circle's public wiki calls to write to its Inbox
   without an account (/wiki/[id]/write) — no session. Like lib/guest-rsvp.ts,
   a result object rather than a throw, and the emailed code comes back to the
   browser only outside production, as the "dev mode" hint. */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const devCode = (code: string) => (process.env.NODE_ENV === "production" ? {} : { code });

async function sendCode(to: string, code: string, circleName: string): Promise<string | null> {
  try {
    await sendEmail({ to, ...guestMessageCodeEmail(code, GUEST_MESSAGE_CODE_MINUTES, circleName) });
    return null;
  } catch (err) {
    console.error("Couldn't send a message code:", err);
    return "We couldn't email you a code — check the address, or try again in a moment.";
  }
}

function failure(err: unknown, what: string): { ok: false; error: string } {
  if (err instanceof UserFacingError) return { ok: false, error: err.message };
  console.error(`Couldn't ${what}:`, err);
  return { ok: false, error: "Something went wrong — try again in a moment." };
}

export async function startGuestMessageAction(circleId: string, name: string, email: string, input: MessageInput): Promise<Result<{ id: string; code?: string }>> {
  try {
    // a mistyped form doesn't spend the allowance
    const problem = validateGuest(name, email) ?? validateMessage(input);
    if (problem) return { ok: false, error: problem };
    await takeAllowance();
    const started = await startGuestMessage(circleId, name, email, input);
    const failed = await sendCode(started.email, started.code, started.circleName);
    return failed ? { ok: false, error: failed } : { ok: true, id: started.id, ...devCode(started.code) };
  } catch (err) {
    return failure(err, "start a guest message");
  }
}

export async function resendGuestMessageCodeAction(id: string): Promise<Result<{ code?: string }>> {
  try {
    await takeAllowance();
    const renewed = await renewGuestMessageCode(id);
    const failed = await sendCode(renewed.email, renewed.code, renewed.circleName);
    return failed ? { ok: false, error: failed } : { ok: true, ...devCode(renewed.code) };
  } catch (err) {
    return failure(err, "resend a guest message code");
  }
}

// the code sends it; its circle is told once the response is out
export async function confirmGuestMessageAction(id: string, code: string): Promise<Result> {
  try {
    const { messageId } = await confirmGuestMessage(id, code);
    after(() => tellCircleOfMessage(messageId));
    return { ok: true };
  } catch (err) {
    return failure(err, "confirm a guest message");
  }
}
