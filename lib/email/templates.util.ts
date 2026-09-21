import type { EmailMessage } from "./index";
import { MONTHS, WEEKDAYS, fmtTime, parseDay } from "@/lib/format.util";
import type { EventKindKey } from "@/lib/types";

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

// event titles and descriptions are typed by members, so anything from data
// is escaped before it goes into HTML
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// app/globals.css's tokens, spelled out (an email can't read CSS variables)
const INK = "#0a0a0a";
const SOFT = "#6b6b6b";
const FAINT = "#e4e4e4";
const FLAME = "#e1530b"; // governance events, as in the app
const SANS = `'Helvetica Neue',Helvetica,Arial,sans-serif`;
const SERIF = `Georgia,'Times New Roman',serif`;

// the app's Eyebrow: small, bold, wide-tracked caps
const eyebrow = (text: string, color = SOFT) =>
  `<div style="font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${color}">${text}</div>`;

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

export interface EventNotificationData {
  title: string;
  kind: EventKindKey;
  date: string;
  start: string;
  end: string;
  location: string;
  description: string;
  circleName: string;
  organizerName: string;
  // where to open it in the app
  url: string;
}

const EXCERPT_CHARS = 400;

// "Thu, Sep 24 · 6:00 PM–8:00 PM", the same shape as the event page's masthead
function whenLabel(d: Pick<EventNotificationData, "date" | "start" | "end">): string {
  const day = parseDay(d.date);
  const time = `${fmtTime(d.start)}–${fmtTime(d.end)}`;
  return isNaN(day.getTime()) ? time : `${WEEKDAYS[day.getDay()]}, ${MONTHS[day.getMonth()]} ${day.getDate()} · ${time}`;
}

export function eventNotificationEmail(n: EventNotificationData): Body {
  const meeting = n.kind === "meeting";
  const noun = meeting ? "meeting" : "event";
  const accent = meeting ? FLAME : INK;
  const when = whenLabel(n);
  const excerpt = n.description.length > EXCERPT_CHARS ? `${n.description.slice(0, EXCERPT_CHARS).trimEnd()}…` : n.description;
  const action = meeting ? "View and vote" : "View event";
  const why = `You're getting this because you're a member of ${n.circleName}.`;
  const detail = (label: string, value: string) =>
    `<tr><td style="padding-bottom:14px">${eyebrow(label)}<div style="margin-top:4px;font-family:${SERIF};font-size:18px;line-height:1.4;color:${INK}">${esc(value)}</div></td></tr>`;
  return {
    subject: `New ${noun} in ${n.circleName}: ${n.title}`,
    text:
      `New ${noun} in ${n.circleName}\n\n${n.title}\n\nWhen: ${when}\nWhere: ${n.location}\nHosted by: ${n.organizerName}\n\n${excerpt}\n\n${action}: ${n.url}\n\n${why}`,
    html: shell(
      `<tr><td style="border-top:3px solid ${INK};padding-top:18px">` +
        eyebrow(`New ${noun} · ${esc(n.circleName)}`, meeting ? FLAME : SOFT) +
        `<div style="margin-top:10px;font-family:${SANS};font-size:32px;font-weight:800;letter-spacing:-0.035em;line-height:1;color:${INK}">${esc(n.title)}</div>` +
        `</td></tr>` +
        `<tr><td style="padding:24px 0 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">` +
        detail("When", when) +
        detail("Where", n.location) +
        detail("Hosted by", n.organizerName) +
        `</table></td></tr>` +
        (excerpt
          ? `<tr><td style="font-family:${SERIF};font-size:16px;line-height:1.55;color:#222222;padding-bottom:24px">${esc(excerpt).replace(/\n/g, "<br>")}</td></tr>`
          : "") +
        `<tr><td style="padding-bottom:28px"><a href="${esc(n.url)}" style="display:inline-block;background:${accent};color:#ffffff;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;padding:14px 22px">${action}</a></td></tr>` +
        `<tr><td style="border-top:1px solid ${FAINT};padding-top:16px;font-family:${SERIF};font-size:14px;line-height:1.5;color:${SOFT}">${esc(why)}</td></tr>`
    ),
  };
}
