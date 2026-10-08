import { createHmac, timingSafeEqual } from "node:crypto";

/* The only file that talks to the SMS provider, Twilio (the same wrapping rule
   as lib/email/ and lib/push/): everything texts through sendSms(). Twilio's
   REST API is a single POST, so there's no SDK.

   TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN authenticate; texts go out through
   TWILIO_MESSAGING_SERVICE_SID, a Messaging Service holding the verified
   toll-free number, which is what lets RCS or another number be added later
   without touching this. Without them, development just logs the text, and
   production throws rather than silently dropping a code. */

export interface SmsMessage {
  // E.164, as lib/phone.util.ts's normalizePhone gives
  to: string;
  body: string;
}

// the recipient has replied STOP, so Twilio won't text them until they reply
// START: the caller should stop trying (and turn their texts off)
export class SmsOptedOutError extends Error {}
// the number can't receive texts (not a mobile, not a real number)
export class SmsUndeliverableError extends Error {}

// Twilio's codes for those two (https://www.twilio.com/docs/api/errors)
const OPTED_OUT = new Set([21610]);
const UNDELIVERABLE = new Set([21211, 21612, 21614]);

export async function sendSms(message: SmsMessage): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const service = process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (!sid || !token || !service) {
    if (process.env.NODE_ENV === "production") throw new Error("Texting isn't configured: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_MESSAGING_SERVICE_SID.");
    console.log(`[text not sent — Twilio unset]\nTo: ${message.to}\n${message.body}`);
    return;
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: message.to, MessagingServiceSid: service, Body: message.body }),
    // short, so an unreachable provider fails the request instead of hanging it
    signal: AbortSignal.timeout(10_000),
  });
  if (res.ok) return;
  const error = (await res.json().catch(() => null)) as { code?: number; message?: string } | null;
  const text = error?.message ?? `Twilio responded ${res.status}`;
  if (error?.code !== undefined && OPTED_OUT.has(error.code)) throw new SmsOptedOutError(text);
  if (error?.code !== undefined && UNDELIVERABLE.has(error.code)) throw new SmsUndeliverableError(text);
  throw new Error(text);
}

/* Whether a request to one of our webhooks really came from Twilio: it signs
   each with the auth token, over the URL it called and the posted fields
   (sorted by name, each name then its value), as X-Twilio-Signature. `url`
   must be the public URL Twilio was given, not whatever this server sees
   behind its proxy. Without a token, development takes anything, so the
   webhook can be tried by hand; production takes nothing. */
export function isFromTwilio(url: string, params: Record<string, string>, signature: string | null): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return process.env.NODE_ENV !== "production";
  if (!signature) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = createHmac("sha1", token).update(data).digest();
  const given = Buffer.from(signature, "base64");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// the keywords carriers and Twilio treat as opting out of texts, and back in
const STOP_WORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "OPTOUT", "REVOKE"]);
const START_WORDS = new Set(["START", "YES", "UNSTOP"]);

/* What a text someone sent us means for their opt-in. Twilio replies to the
   keywords itself and stops or resumes texting the number on its side; this
   is so the app knows too. It names the keyword's kind in OptOutType where
   Advanced Opt-Out is on, and otherwise the message is the keyword alone.
   HELP and anything else are "none". */
export function optOutIntent(params: Record<string, string>): "stop" | "start" | "none" {
  const type = params.OptOutType?.toUpperCase();
  if (type === "STOP") return "stop";
  if (type === "START") return "start";
  if (type) return "none";
  const word = (params.Body ?? "").trim().toUpperCase();
  return STOP_WORDS.has(word) ? "stop" : START_WORDS.has(word) ? "start" : "none";
}
