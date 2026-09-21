import type { EmailMessage } from "./index";

/* The app's outgoing emails, as pure functions from data to a message body.
   Each returns everything but the recipient, so the caller (which knows who
   it's for) adds `to`. Plain text is the real content; the HTML is the same
   words dressed like the app — ink on white, Helvetica for display and
   Georgia for reading, hard edges, a heavy rule across the top, hairlines
   between parts — using the same values as the @theme tokens in
   app/globals.css. Inline styles and tables only, since mail clients strip
   <style> and are unreliable with anything fancier. */

export const LOGIN_CODE_MINUTES = 10;

type Body = Omit<EmailMessage, "to">;

// app/globals.css's tokens, spelled out (an email can't read CSS variables)
const INK = "#0a0a0a";
const SOFT = "#6b6b6b";
const FAINT = "#e4e4e4";
const SANS = `'Helvetica Neue',Helvetica,Arial,sans-serif`;
const SERIF = `Georgia,'Times New Roman',serif`;

// the app's Eyebrow: small, bold, wide-tracked caps
const eyebrow = (text: string) =>
  `<div style="font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${SOFT}">${text}</div>`;

function shell(bodyRows: string): string {
  return (
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
    `<body style="margin:0;padding:0;background:#ffffff">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#ffffff"><tr><td align="center" style="padding:32px 16px">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;max-width:480px;text-align:left">${bodyRows}</table>` +
    `</td></tr></table></body></html>`
  );
}

export function loginCodeEmail(code: string): Body {
  const expiry = `It works once and expires in ${LOGIN_CODE_MINUTES} minutes.`;
  const ignore = `If you didn't ask to sign in, you can safely ignore this email — nobody can sign in without this code.`;
  return {
    subject: "Your Circles sign-in code",
    text: `Your Circles sign-in code\n\n    ${code}\n\n${expiry}\n\n${ignore}`,
    html: shell(
      // masthead: the welcome page's rule, eyebrow, and wordmark
      `<tr><td style="border-top:3px solid ${INK};padding-top:18px">` +
        eyebrow("Your sign-in code for") +
        `<div style="margin-top:10px;font-family:${SANS};font-size:44px;font-weight:800;letter-spacing:-0.04em;line-height:0.95;color:${INK}">Circles</div>` +
        `</td></tr>` +
        // the code: the one thing to read, so it's the biggest thing here, in a
        // hard-edged box. Right padding is the left padding plus the tracking
        // that trails the last digit, so the digits sit optically centered.
        `<tr><td style="padding:28px 0 24px"><div style="border:2px solid ${INK};padding:26px 16px 26px 24px;text-align:center;font-family:${SANS};font-size:52px;font-weight:800;letter-spacing:0.16em;line-height:1;color:${INK}">${code}</div></td></tr>` +
        `<tr><td style="font-family:${SERIF};font-size:18px;line-height:1.55;color:#222222;padding-bottom:20px">${expiry}</td></tr>` +
        // footer: hairline, then the quiet part
        `<tr><td style="border-top:1px solid ${FAINT};padding-top:16px;font-family:${SERIF};font-size:14px;line-height:1.5;color:${SOFT}">${ignore}</td></tr>`
    ),
  };
}
