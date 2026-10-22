import nodemailer, { type Transporter } from "nodemailer";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  // extra headers, e.g. List-Unsubscribe
  headers?: Record<string, string>;
}

/* The only file that imports "nodemailer" (the same wrapping rule as lib/db/
   and lib/better-auth.ts) — everything else sends mail through sendEmail().
   Plain SMTP on purpose: every provider (Postmark, Resend, SES, Mailgun, ...)
   and any self-hosted server speaks it, so switching is a change of SMTP_URL,
   not of code. In development that URL points at Mailpit (docker-compose.yml),
   which catches every message in a web inbox at http://localhost:8025 instead
   of delivering it.

   SMTP_URL, e.g. smtp://localhost:1025 (Mailpit) or
   smtps://user:password@smtp.example.com:465 (a real relay — prefer smtps://,
   which is encrypted from the first byte, over plain smtp://).
   EMAIL_FROM, e.g. "Circles <login@example.com>" — must be an address the
   relay is allowed to send as (SPF/DKIM set up on its domain), or messages
   land in spam.

   Without both set, development just logs the message so the app still runs
   with no mail catcher up; production refuses to send rather than silently
   dropping a login code. */
let transport: Transporter | undefined;

function getTransport(): Transporter | null {
  const url = process.env.SMTP_URL;
  if (!url) return null;
  // short timeouts, so an unreachable relay fails the request instead of
  // leaving someone staring at "Sending…"
  transport ??= nodemailer.createTransport({ url, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 });
  return transport;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  const from = process.env.EMAIL_FROM;
  const smtp = getTransport();
  if (!smtp || !from) {
    if (process.env.NODE_ENV === "production") throw new Error("Email isn't configured: set SMTP_URL and EMAIL_FROM.");
    console.log(`[email not sent — SMTP_URL/EMAIL_FROM unset]\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}`);
    return;
  }
  await smtp.sendMail({ from, ...message });
}
