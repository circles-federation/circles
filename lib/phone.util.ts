/* Members' mobile numbers, for text notifications (see lib/sms/). Pure rules,
   shared by the forms and the server. Only US and Canadian numbers: the
   toll-free number Circles texts from can't reach anywhere else. Kept as
   E.164 ("+14015550123"), the form a provider sends to. */

/* The opt-in shown wherever someone gives their number — applying, and
   Settings — and recorded with it (the exact words, and when), since US law
   and the carriers want proof of what was agreed to. It says who's texting,
   that how often varies, that rates may apply, and how to stop or get help:
   what toll-free verification asks a sign-up to say. Change it and the
   recorded copies keep the old wording, as they should. */
export const SMS_CONSENT_NOTICE =
  "Circles will text you notifications about your circles at this number. Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.";

/* A number as typed, in whatever shape ("401-555-0123", "(401) 555 0123",
   "+1 401 555 0123"), as E.164, or null if it isn't a US or Canadian number:
   ten digits (an eleventh, leading 1 allowed), whose area code and exchange
   don't start with 0 or 1. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(ten)) return null;
  return `+1${ten}`;
}

// "+14015550123" as "(401) 555-0123", for showing it back to its owner
export function formatPhone(e164: string): string {
  const ten = e164.replace(/^\+1/, "");
  return ten.length === 10 ? `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}` : e164;
}

/* A number field's value as it's typed: once it's bare digits making a whole
   number (ten, or eleven with a leading 1), shown as "(401) 555-0123".
   Anything else, a number still being typed or one typed with its own
   punctuation, is left as it is, so the caret never jumps mid-edit. */
export function formatTypedPhone(input: string): string {
  if (!/^\d+$/.test(input)) return input;
  const phone = normalizePhone(input);
  return phone ? formatPhone(phone) : input;
}

export const PHONE_INVALID = "Enter a US or Canadian mobile number, like (401) 555-0123.";
