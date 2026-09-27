import type { EmailMessage } from "./index";
import { MONTHS, WEEKDAYS, fmtTime, parseDay } from "@/lib/format.util";
import { AGENDA_CATEGORY } from "@/lib/agenda.util";
import { endedBefore, repeatSummary } from "@/lib/recurrence.util";
import type { AgendaItem, CircleType, EventKindKey, EventRepeat, NotificationKind } from "@/lib/types";

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
const AGENDA = "#008480"; // a meeting's agenda items
const LEAF = "#2e7d32"; // approved ones
const DANGER = "#c0392b"; // a cancelled event, as the app's destructive red
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
  // which email this is — see NotificationKind
  notice: NotificationKind;
  title: string;
  kind: EventKindKey;
  date: string;
  start: string;
  end: string;
  location: string;
  description: string;
  // the circle the event is shown to
  circleName: string;
  circleType: CircleType;
  // set when a circle hosts it
  hostCircleName?: string;
  // a circle-hosted event still awaiting its host circle's vote, and how many
  // approving votes that takes
  proposed: boolean;
  votesNeeded: number;
  // the voting circle's Leader, Secretary or Facilitator created it, so it
  // needed no vote: that role's name
  approvedByRole?: string;
  organizerName: string;
  // set on a date of a repeating event
  repeat?: Pick<EventRepeat, "frequency" | "startsOn" | "until">;
  // a meeting's agenda, which it has instead of a description
  agenda?: AgendaItem[];
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
  if (n.notice === "cancelled") return cancelledEventEmail(n);
  const meeting = n.kind === "meeting";
  // five flavors:
  // - approved meeting: it just reached the votes it needed, told to its circle;
  // - approved event: a circle-hosted event was just approved, told to the
  //   circle it is now open to;
  // - proposal: a circle-hosted event asks its host circle's members to vote;
  // - hosted: that same email going out after the vote already passed (it
  //   isn't a request for votes any more);
  // - plain: an event or meeting a person hosts (a meeting asks for votes,
  //   unless its circle's Leader, Secretary or Facilitator scheduled it).
  const decided = n.notice === "approved";
  const approvedMeeting = decided && meeting;
  const approvedEvent = decided && !meeting;
  const proposal = n.notice === "proposed" && n.proposed && !!n.hostCircleName;
  const scheduled = meeting && !!n.approvedByRole;
  const voting = proposal || (!decided && meeting && !scheduled);
  // whose member the reader is: the host circle's for what's sent to voters
  const because = n.notice === "proposed" ? (n.hostCircleName ?? n.circleName) : n.circleName;
  const noun = approvedEvent ? "approved event" : approvedMeeting ? "approved meeting" : proposal ? "proposed event" : meeting ? "meeting" : "event";
  // what's been decided reads as "Approved meeting", not "New approved meeting"
  const lead = decided ? noun : `new ${noun}`;
  const Lead = lead.charAt(0).toUpperCase() + lead.slice(1);
  const accent = voting ? FLAME : INK;
  const tone = decided ? LEAF : voting ? FLAME : SOFT;
  const when = whenLabel(n);
  const excerpt = n.description.length > EXCERPT_CHARS ? `${n.description.slice(0, EXCERPT_CHARS).trimEnd()}…` : n.description;
  const action = voting ? "View and vote" : "View event";
  const why = `You're getting this because you're a member of ${because}.`;
  const noteBorder = decided || scheduled ? LEAF : FLAME;
  // what a meeting asks of its circle, in the app's own words ("residents" of a
  // neighborhood, "members" of anything else) — voting is also the RSVP
  const voters = n.circleType === "neighborhood" ? "residents" : "members";
  const meetingNote =
    scheduled && n.notice === "new"
      ? `${n.organizerName}, ${n.circleName}'s ${n.approvedByRole}, scheduled this meeting. It doesn't need a vote — RSVP if you're coming.`
      : meeting && n.notice === "new"
      ? `${n.organizerName} proposed this meeting for ${n.circleName}. It needs ${n.votesNeeded} vote${n.votesNeeded === 1 ? "" : "s"} from ${voters} of ${n.circleName} to be held — voting is also how you RSVP.`
      : "";
  const note = meetingNote ||
    (approvedMeeting
      ? `${n.circleName} has the ${n.votesNeeded} vote${n.votesNeeded === 1 ? "" : "s"} this meeting needed, so it's approved.`
      : proposal
    ? `${n.organizerName} proposed this for ${n.circleName}. It needs ${n.votesNeeded} approving vote${n.votesNeeded === 1 ? "" : "s"} from ${because} members before it opens up to ${n.circleName}.`
    : approvedEvent && n.approvedByRole
      ? `${n.organizerName}, ${n.hostCircleName ?? "the circle"}'s ${n.approvedByRole}, approved this event, so it's now open to everyone in ${n.circleName}.`
    : approvedEvent
      ? `${n.hostCircleName ?? "A circle"} approved this event, so it's now open to everyone in ${n.circleName}.`
      : "");
  const subject = proposal
    ? `New proposal in ${because}: ${n.title}`
    : approvedMeeting
      ? `Meeting approved in ${because}: ${n.title}`
      : approvedEvent
      ? `New event in ${because}: ${n.title}`
      : `New ${noun} in ${because}: ${n.title}`;
  const detail = (label: string, value: string) =>
    `<tr><td style="padding-bottom:14px">${eyebrow(label)}<div style="margin-top:4px;font-family:${SERIF};font-size:18px;line-height:1.4;color:${INK}">${esc(value)}</div></td></tr>`;
  // a circle-hosted event is hosted by its circle, with the person who put it
  // forward named as its proposer
  const people: [string, string][] =
    approvedEvent && n.hostCircleName
      ? [["Hosted by", n.hostCircleName], n.approvedByRole ? ["Approved by", `${n.organizerName}, ${n.approvedByRole}`] : ["Proposed by", n.organizerName]]
      : [[scheduled ? "Scheduled by" : proposal || meeting ? "Proposed by" : "Hosted by", n.organizerName]];
  // a repeating event is announced once, by its first date, so this is where
  // members learn the rest
  const repeats = n.repeat ? repeatSummary(n.repeat) : "";
  const agenda = n.agenda ?? [];
  return {
    subject,
    text:
      `${Lead} in ${because}\n\n${n.title}\n\n` +
      (note ? `${note}\n\n` : "") +
      `When: ${when}\n${repeats ? `Repeats: ${repeats}\n` : ""}Where: ${n.location}\n${people.map(([l, v]) => `${l}: ${v}`).join("\n")}\n\n` +
      (agenda.length > 0 ? `Agenda:\n${agendaText(agenda)}\n\n` : excerpt ? `${excerpt}\n\n` : "") +
      `${action}: ${n.url}\n\n${why}`,
    html: shell(
      `<tr><td style="border-top:3px solid ${INK};padding-top:18px">` +
        eyebrow(`${Lead} · ${esc(because)}`, tone) +
        `<div style="margin-top:10px;font-family:${SANS};font-size:32px;font-weight:800;letter-spacing:-0.035em;line-height:1;color:${INK}">${esc(n.title)}</div>` +
        `</td></tr>` +
        // the app's colored-rule note: orange for what a proposal needs from
        // the reader, green for what's been decided
        (note
          ? `<tr><td style="padding-top:20px"><div style="border-left:3px solid ${noteBorder};padding-left:12px;font-family:${SERIF};font-size:16px;line-height:1.5;color:#222222">${esc(note)}</div></td></tr>`
          : "") +
        `<tr><td style="padding:24px 0 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">` +
        detail("When", when) +
        (repeats ? detail("Repeats", repeats) : "") +
        detail("Where", n.location) +
        people.map(([l, v]) => detail(l, v)).join("") +
        `</table></td></tr>` +
        (agenda.length > 0 ? agendaHtml(agenda) : "") +
        (excerpt
          ? `<tr><td style="font-family:${SERIF};font-size:16px;line-height:1.55;color:#222222;padding-bottom:24px">${esc(excerpt).replace(/\n/g, "<br>")}</td></tr>`
          : "") +
        `<tr><td style="padding-bottom:28px"><a href="${esc(n.url)}" style="display:inline-block;background:${accent};color:#ffffff;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;padding:14px 22px">${action}</a></td></tr>` +
        `<tr><td style="border-top:1px solid ${FAINT};padding-top:16px;font-family:${SERIF};font-size:14px;line-height:1.5;color:${SOFT}">${esc(why)}</td></tr>`
    ),
  };
}

// "1. [D] Decide: Repair budget", its details indented beneath
function agendaText(items: AgendaItem[]): string {
  return items
    .map((a, i) => {
      const { letter, label } = AGENDA_CATEGORY[a.category];
      return `${i + 1}. [${letter}] ${label}: ${a.title}${a.details ? `\n   ${a.details.replace(/\n/g, "\n   ")}` : ""}`;
    })
    .join("\n");
}

// the app's agenda cards, as far as an email allows: a turquoise rule and the
// category's letter in a solid square, then the title and any details
function agendaHtml(items: AgendaItem[]): string {
  const rows = items
    .map((a) => {
      const { letter, label } = AGENDA_CATEGORY[a.category];
      return (
        `<tr><td style="padding-bottom:10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${INK};border-top:3px solid ${AGENDA}"><tr><td style="padding:12px 14px">` +
        `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>` +
        `<td style="width:24px;height:24px;background:${AGENDA};color:#ffffff;text-align:center;font-family:${SANS};font-size:14px;font-weight:800">${letter}</td>` +
        `<td style="padding-left:8px">${eyebrow(label, AGENDA)}</td></tr></table>` +
        `<div style="margin-top:8px;font-family:${SANS};font-size:16px;font-weight:700;line-height:1.25;color:${INK}">${esc(a.title)}</div>` +
        (a.details ? `<div style="margin-top:6px;font-family:${SERIF};font-size:14px;line-height:1.5;color:#222222">${esc(a.details).replace(/\n/g, "<br>")}</div>` : "") +
        `</td></tr></table></td></tr>`
      );
    })
    .join("");
  return `<tr><td style="padding-bottom:18px">${eyebrow("Agenda")}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:10px">${rows}</table></td></tr>`;
}

export interface DigestEventData {
  // why it's in the digest: a new event or meeting, a proposal to vote on, or
  // a meeting that just got its votes
  notice: NotificationKind;
  title: string;
  kind: EventKindKey;
  date: string;
  start: string;
  end: string;
  location: string;
  // the circle it's shown to; hostCircleName is set for a circle-hosted event
  circleName: string;
  hostCircleName?: string;
  // see EventNotificationData
  approvedByRole?: string;
  organizerName: string;
  repeat?: Pick<EventRepeat, "frequency" | "startsOn" | "until">;
  url: string;
}

const dateBox = (iso: string) => {
  const day = parseDay(iso);
  if (isNaN(day.getTime())) return "";
  // the app's DateTile: month over day in a hard-edged box
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${INK};width:56px"><tr><td align="center" style="padding:6px 0 0;font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${SOFT}">${MONTHS[day.getMonth()]}</td></tr>` +
    `<tr><td align="center" style="padding:0 0 6px;font-family:${SANS};font-size:24px;font-weight:800;line-height:1.1;color:${INK}">${day.getDate()}</td></tr></table>`
  );
};

/* The once-a-day digest: what's new, since the last one, in the circles this
   member belongs to that are too big to email about one event at a time (they
   have sub-circles) — new events and meetings, proposals waiting on their
   vote, and meetings that just got their votes. Grouped by the circle the
   reader belongs to (for a proposal, the host circle that votes on it),
   soonest first. The caller passes only what's still to come, one entry per
   event. */
export function eventDigestEmail(events: DigestEventData[]): Body {
  const count = events.length;
  const groupOf = (e: DigestEventData) => (e.notice === "proposed" ? (e.hostCircleName ?? e.circleName) : e.circleName);
  const groups = new Map<string, DigestEventData[]>();
  for (const e of [...events].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))) {
    groups.set(groupOf(e), [...(groups.get(groupOf(e)) ?? []), e]);
  }
  const circleNames = [...groups.keys()].sort((a, b) => a.localeCompare(b));
  // "3 new events" while that's all it is; "3 updates" once it mixes in votes to
  // cast or meetings approved
  const allNew = events.every((e) => e.notice === "new");
  const heading = allNew ? `${count} new event${count === 1 ? "" : "s"}` : `${count} update${count === 1 ? "" : "s"}`;
  const meta = (e: DigestEventData) => `${whenLabel(e)} · ${e.location}`;
  const by = (e: DigestEventData) =>
    (e.notice === "proposed"
      ? `Proposed by ${e.organizerName} for ${e.circleName}`
      : e.approvedByRole
        ? `Scheduled by ${e.organizerName}, ${e.approvedByRole}`
        : `${e.kind === "meeting" ? "Proposed" : "Hosted"} by ${e.organizerName}`) +
    (e.repeat ? ` · ${repeatSummary(e.repeat)}` : "");
  // the label over a line, and the color it's drawn in
  const label = (e: DigestEventData): { text: string; color: string } | null =>
    e.notice === "proposed"
      ? { text: "Event · Vote to Approve", color: FLAME }
      : e.notice === "approved"
        ? { text: "Meeting Approved", color: LEAF }
        : e.kind === "meeting"
          ? e.approvedByRole ? { text: "Meeting", color: INK } : { text: "Meeting · Vote to Approve", color: FLAME }
          : null;
  const openAll = `${events[0]?.url.replace(/\/events\/.*$/, "") ?? ""}/events`;
  const why = `You're getting this because you're a member of ${circleNames.join(", ")}.`;

  const text =
    `Your Circles digest — ${heading}\n\n` +
    circleNames
      .map((c) =>
        `${c.toUpperCase()}\n` +
        groups
          .get(c)!
          .map((e) => `- ${e.title}${label(e) ? ` (${label(e)!.text.toLowerCase()})` : ""}\n  ${meta(e)}\n  ${by(e)}\n  ${e.url}`)
          .join("\n\n")
      )
      .join("\n\n") +
    `\n\nSee all events: ${openAll}\n\n${why}`;

  const row = (e: DigestEventData) => {
    const l = label(e);
    return (
      `<tr><td style="padding:0 0 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>` +
      `<td width="56" valign="top" style="width:56px">${dateBox(e.date)}</td>` +
      `<td valign="top" style="padding-left:14px">` +
      (l ? `${eyebrow(l.text, l.color)}<div style="height:3px"></div>` : "") +
      `<a href="${esc(e.url)}" style="font-family:${SANS};font-size:18px;font-weight:700;line-height:1.25;color:${INK};text-decoration:underline">${esc(e.title)}</a>` +
      `<div style="margin-top:3px;font-family:${SERIF};font-size:15px;line-height:1.45;color:${SOFT}">${esc(meta(e))}<br>${esc(by(e))}</div>` +
      `</td></tr></table></td></tr>`
    );
  };

  return {
    subject: `Circles digest: ${heading}`,
    text,
    html: shell(
      `<tr><td style="border-top:3px solid ${INK};padding-top:18px">` +
        eyebrow("Your daily digest") +
        `<div style="margin-top:10px;font-family:${SANS};font-size:32px;font-weight:800;letter-spacing:-0.035em;line-height:1;color:${INK}">${heading}</div>` +
        `</td></tr>` +
        circleNames
          .map(
            (c) =>
              `<tr><td style="padding-top:26px"><div style="border-bottom:1px solid ${INK};padding-bottom:8px;margin-bottom:16px">${eyebrow(esc(c))}</div></td></tr>` +
              groups.get(c)!.map(row).join("")
          )
          .join("") +
        `<tr><td style="padding:10px 0 28px"><a href="${esc(openAll)}" style="display:inline-block;background:${INK};color:#ffffff;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;padding:14px 22px">See all events</a></td></tr>` +
        `<tr><td style="border-top:1px solid ${FAINT};padding-top:16px;font-family:${SERIF};font-size:14px;line-height:1.5;color:${SOFT}">${esc(why)}</td></tr>`
    ),
  };
}

/* To someone who was going: the organizer called it off. The facts they'd
   planned around (when, where) are repeated so they know which event it was,
   and there's no call to act on beyond seeing it in the app. */
function cancelledEventEmail(n: EventNotificationData): Body {
  const noun = n.kind === "meeting" ? "meeting" : "event";
  const when = whenLabel(n);
  // a date of a repeating event is cancelled alone, or with every later date
  // (its series then ends before it)
  const note = !n.repeat
    ? `${n.organizerName} cancelled this ${noun}, so it won't be going ahead.`
    : endedBefore(n.repeat, n.date)
      ? `${n.organizerName} cancelled this ${n.repeat.frequency} ${noun} from this date on, so neither this date nor any after it will be going ahead.`
      : `${n.organizerName} cancelled this date of a ${n.repeat.frequency} ${noun}. The other dates are still on.`;
  const why = `You're getting this because you were going to it.`;
  const detail = (label: string, value: string) =>
    `<tr><td style="padding-bottom:14px">${eyebrow(label)}<div style="margin-top:4px;font-family:${SERIF};font-size:18px;line-height:1.4;color:${INK}">${esc(value)}</div></td></tr>`;
  return {
    subject: `Cancelled: ${n.title}`,
    text: `Cancelled ${noun} in ${n.circleName}\n\n${n.title}\n\n${note}\n\nWas: ${when}\nWhere: ${n.location}\n\nView it: ${n.url}\n\n${why}`,
    html: shell(
      `<tr><td style="border-top:3px solid ${DANGER};padding-top:18px">` +
        eyebrow(`Cancelled ${noun} · ${esc(n.circleName)}`, DANGER) +
        `<div style="margin-top:10px;font-family:${SANS};font-size:32px;font-weight:800;letter-spacing:-0.035em;line-height:1;color:${INK}">${esc(n.title)}</div>` +
        `</td></tr>` +
        `<tr><td style="padding-top:20px"><div style="border-left:3px solid ${DANGER};padding-left:12px;font-family:${SERIF};font-size:16px;line-height:1.5;color:#222222">${esc(note)}</div></td></tr>` +
        `<tr><td style="padding:24px 0 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">` +
        detail("Was", when) +
        detail("Where", n.location) +
        `</table></td></tr>` +
        `<tr><td style="padding-bottom:28px"><a href="${esc(n.url)}" style="display:inline-block;background:${INK};color:#ffffff;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;padding:14px 22px">View event</a></td></tr>` +
        `<tr><td style="border-top:1px solid ${FAINT};padding-top:16px;font-family:${SERIF};font-size:14px;line-height:1.5;color:${SOFT}">${esc(why)}</td></tr>`
    ),
  };
}

// the masthead every application email opens with: the welcome page's rule,
// eyebrow and wordmark
const applicationMasthead = (label: string) =>
  `<tr><td style="border-top:3px solid ${INK};padding-top:18px">` +
  eyebrow(label) +
  `<div style="margin-top:10px;font-family:${SANS};font-size:44px;font-weight:800;letter-spacing:-0.04em;line-height:0.95;color:${INK}">Circles</div>` +
  `</td></tr>`;
const paragraph = (text: string) => `<tr><td style="font-family:${SERIF};font-size:18px;line-height:1.55;color:#222222;padding-bottom:20px">${text}</td></tr>`;
const footnote = (text: string) =>
  `<tr><td style="border-top:1px solid ${FAINT};padding-top:16px;font-family:${SERIF};font-size:14px;line-height:1.5;color:${SOFT}">${text}</td></tr>`;

// confirms an applicant's email is really theirs, before anyone reviews it
export function applicationCodeEmail(code: string, minutes: number): Body {
  const expiry = `Enter it on the application page to send your application for review. It expires in ${minutes} minutes.`;
  const ignore = `If you didn't apply to join Circles, you can ignore this email — nothing happens without this code.`;
  return {
    subject: "Confirm your Circles application",
    text: `Confirm your Circles application\n\n    ${code}\n\n${expiry}\n\n${ignore}`,
    html: shell(
      applicationMasthead("Confirm your application to") +
        `<tr><td style="padding:28px 0 24px"><div style="border:2px solid ${INK};padding:26px 16px 26px 24px;text-align:center;font-family:${SANS};font-size:52px;font-weight:800;letter-spacing:0.16em;line-height:1;color:${INK}">${code}</div></td></tr>` +
        paragraph(expiry) +
        footnote(ignore)
    ),
  };
}

export function applicationApprovedEmail(d: { firstName: string; neighborhoodName: string; url: string }): Body {
  const body = `Your application has been approved, and you're now a member of ${d.neighborhoodName}. Sign in with this email address — we'll send you a code each time, with no password to remember.`;
  return {
    subject: "Welcome to Circles",
    text: `Welcome to Circles, ${d.firstName}\n\n${body}\n\nSign in: ${d.url}`,
    html: shell(
      applicationMasthead("Welcome to") +
        `<tr><td style="padding-top:24px"></td></tr>` +
        paragraph(`${esc(d.firstName)}, ${esc(body)}`) +
        `<tr><td style="padding-bottom:28px"><a href="${esc(d.url)}" style="display:inline-block;background:${INK};color:#ffffff;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;padding:14px 22px">Sign in</a></td></tr>`
    ),
  };
}

export function applicationDeclinedEmail(d: { firstName: string; neighborhoodName: string; note?: string }): Body {
  const body = `Thank you for applying to join ${d.neighborhoodName || "Circles"}. We weren't able to approve your application this time.`;
  const noteLabel = "A note from the reviewer";
  const after = "If something has changed, or you think this was a mistake, you're welcome to apply again.";
  return {
    subject: "Your Circles application",
    text: `${d.firstName},\n\n${body}\n\n${d.note ? `${noteLabel}:\n${d.note}\n\n` : ""}${after}`,
    html: shell(
      applicationMasthead("Your application to") +
        `<tr><td style="padding-top:24px"></td></tr>` +
        paragraph(`${esc(d.firstName)}, ${esc(body)}`) +
        (d.note
          ? `<tr><td style="padding-bottom:20px">${eyebrow(noteLabel)}<div style="margin-top:8px;border-left:3px solid ${INK};padding-left:12px;font-family:${SERIF};font-size:16px;line-height:1.5;color:#222222">${esc(d.note).replace(/\n/g, "<br>")}</div></td></tr>`
          : "") +
        footnote(after)
    ),
  };
}
