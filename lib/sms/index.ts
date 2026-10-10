import { createPublicKey, verify } from "node:crypto";

/* The only file that talks to the SMS provider, Telnyx (the same wrapping rule
   as lib/email/ and lib/push/): everything texts through sendSms(), and the
   provider's webhooks are read through readSmsWebhook(), so nothing else
   knows which provider it is. Telnyx's REST API is a single POST, so there's
   no SDK.

   TELNYX_API_KEY authenticates; texts go out from TELNYX_FROM_NUMBER, the
   verified toll-free number (E.164), which belongs to a messaging profile
   whose webhook is /api/sms/inbound. Without them, development just logs the
   text, and production throws rather than silently dropping a code. */

export interface SmsMessage {
  // E.164, as lib/phone.util.ts's normalizePhone gives
  to: string;
  body: string;
}

// the recipient has replied STOP, so the provider won't text them until they
// reply START: the caller should stop trying (and turn their texts off)
export class SmsOptedOutError extends Error {}
// the number can't receive texts (a landline, not a real number)
export class SmsUndeliverableError extends Error {}

// Telnyx's codes for those two (https://developers.telnyx.com/docs/messaging/messages/error-codes):
// blocked by a STOP; and not routable (a landline), an invalid destination, an invalid "to"
const OPTED_OUT = new Set(["40300"]);
const UNDELIVERABLE = new Set(["40001", "40012", "40310"]);

type TelnyxError = { code?: string | number; title?: string; detail?: string };
const codeOf = (e: TelnyxError) => String(e.code ?? "");

export async function sendSms(message: SmsMessage): Promise<void> {
  const key = process.env.TELNYX_API_KEY;
  const from = process.env.TELNYX_FROM_NUMBER;
  if (!key || !from) {
    if (process.env.NODE_ENV === "production") throw new Error("Texting isn't configured: set TELNYX_API_KEY and TELNYX_FROM_NUMBER.");
    console.log(`[text not sent — Telnyx unset]\nTo: ${message.to}\n${message.body}`);
    return;
  }
  const res = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: message.to, text: message.body }),
    // short, so an unreachable provider fails the request instead of hanging it
    signal: AbortSignal.timeout(10_000),
  });
  if (res.ok) return;
  const body = (await res.json().catch(() => null)) as { errors?: TelnyxError[] } | null;
  const error = body?.errors?.[0];
  const text = error ? `${error.title ?? "Error"}${error.detail ? `: ${error.detail}` : ""} (${codeOf(error)})` : `Telnyx responded ${res.status}`;
  if (error && OPTED_OUT.has(codeOf(error))) throw new SmsOptedOutError(text);
  if (error && UNDELIVERABLE.has(codeOf(error))) throw new SmsUndeliverableError(text);
  throw new Error(text);
}

/* What one of the provider's webhooks says about a member's number, as far as
   the app cares: they've replied STOP or START (the provider answers those
   itself and stops or resumes texting them; this is so the app knows too),
   or a text to them failed for good after it was accepted, because they'd
   opted out or because the number can't take texts. Anything else (HELP, an
   ordinary reply, a delivered text) is "none", for now. */
export type SmsWebhookEvent = { kind: "stop" | "start" | "optedOut" | "undeliverable"; phone: string } | { kind: "none" };

// keywords that opt out of texts, and back in, for when Telnyx doesn't say
// which in autoresponse_type. YES isn't one of Telnyx's, so a reply can mean yes.
const STOP_WORDS = new Set(["STOP", "STOPALL", "STOP ALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "OPTOUT", "REVOKE"]);
const START_WORDS = new Set(["START", "UNSTOP"]);

// how far a webhook's timestamp may be from now, against replays
const WEBHOOK_TOLERANCE_S = 300;

/* Whether a request to one of our webhooks really came from Telnyx: it signs
   "<telnyx-timestamp>|<the body exactly as sent>" with its Ed25519 key, whose
   public half is TELNYX_PUBLIC_KEY (base64, from Mission Control → Keys &
   Credentials → Public Key). Without one, development takes anything, so the
   webhook can be tried by hand; production takes nothing. */
function isFromTelnyx(rawBody: string, headers: Headers): boolean {
  const publicKey = process.env.TELNYX_PUBLIC_KEY;
  if (!publicKey) return process.env.NODE_ENV !== "production";
  const signature = headers.get("telnyx-signature-ed25519");
  const timestamp = headers.get("telnyx-timestamp");
  if (!signature || !timestamp || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > WEBHOOK_TOLERANCE_S) return false;
  try {
    const key = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: Buffer.from(publicKey, "base64").toString("base64url") }, format: "jwk" });
    return verify(null, Buffer.from(`${timestamp}|${rawBody}`), key, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}

type TelnyxWebhook = {
  data?: {
    event_type?: string;
    payload?: {
      from?: { phone_number?: string };
      to?: { phone_number?: string }[];
      text?: string;
      autoresponse_type?: string;
      errors?: TelnyxError[];
    };
  };
};

/* Reads a webhook from its raw body and headers: null if it isn't really from
   the provider (or isn't JSON), otherwise what it means (see SmsWebhookEvent).
   Telnyx sends both kinds to the one URL: "message.received" for a text sent
   to us, and "message.finalized" once one of ours has been delivered or has
   failed. */
export function readSmsWebhook(rawBody: string, headers: Headers): SmsWebhookEvent | null {
  if (!isFromTelnyx(rawBody, headers)) return null;
  let hook: TelnyxWebhook;
  try {
    hook = JSON.parse(rawBody) as TelnyxWebhook;
  } catch {
    return null;
  }
  const payload = hook.data?.payload;
  if (hook.data?.event_type === "message.received") {
    const phone = payload?.from?.phone_number;
    if (!phone) return { kind: "none" };
    const type = payload?.autoresponse_type?.toUpperCase();
    const word = (payload?.text ?? "").trim().toUpperCase();
    if (type === "STOP" || (!type && STOP_WORDS.has(word))) return { kind: "stop", phone };
    if (type === "START" || (!type && START_WORDS.has(word))) return { kind: "start", phone };
    return { kind: "none" };
  }
  if (hook.data?.event_type === "message.finalized") {
    const phone = payload?.to?.[0]?.phone_number;
    const codes = (payload?.errors ?? []).map(codeOf);
    if (!phone) return { kind: "none" };
    if (codes.some((c) => OPTED_OUT.has(c))) return { kind: "optedOut", phone };
    if (codes.some((c) => UNDELIVERABLE.has(c))) return { kind: "undeliverable", phone };
  }
  return { kind: "none" };
}
