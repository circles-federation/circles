import type { EmailMessage } from "./index";
import { MONTHS, WEEKDAYS, fmtDateTime, fmtEventWhen, fmtNumericDate, fmtTime, parseDay, withArticle } from "@/lib/format.util";
import { isEventProposal, proposalTitle } from "@/lib/proposals.util";
import { AGENDA_CATEGORY } from "@/lib/agenda.util";
import { endedBefore, relativeDayWord, repeatSummary } from "@/lib/recurrence.util";
import { autoCancelClock } from "@/lib/roles.util";
import type { AgendaItem, CircleType, EventChange, EventKindKey, GuestNoticeKind, EventRepeat, NotificationKind, ProposalChanges, ProposalKind, ProposalLine, ProposalNoticeKind } from "@/lib/types";

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
const WARNING = "#f0b400"; // a heads-up, like a slot still short (the app's warning yellow): rules and fills, never text
const AGENDA = "#008480"; // a meeting's agenda items
const LEAF = "#2e7d32"; // approved ones
const DANGER = "#c0392b"; // a cancelled event, as the app's destructive red
const ANNOUNCEMENT = "#c0392b"; // a bulletin announcement (the same red, for a different job, as in the app)
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
  // an "updated" notice's when and where from before the change
  change?: EventChange;
  // cancelled by the app, because a required slot was still short 15 minutes
  // before the start
  cancelledAutomatically?: boolean;
  // whether a short slot still gets it cancelled automatically (a "short"
  // warning says when, or that it won't be)
  autoCancel?: boolean;
  // a reminder's: the slots the reader holds, the slots still short of their
  // minimum, and the day it's sent (to say "today" or "tomorrow")
  mySlots?: string[];
  openSlots?: { label: string; min: number; filled: number }[];
  today?: string;
  // where to open it in the app
  url: string;
  // a guest's email carries a link to stop them (see lib/db/guest-rsvps.ts)
  unsubscribeUrl?: string;
}

const EXCERPT_CHARS = 400;

// a guest's footer: why they're getting this, and the way to stop it
const stopText = (n: Pick<EventNotificationData, "unsubscribeUrl">) => (n.unsubscribeUrl ? `\n\nStop these emails: ${n.unsubscribeUrl}` : "");
const stopHtml = (n: Pick<EventNotificationData, "unsubscribeUrl">) =>
  n.unsubscribeUrl ? ` <a href="${esc(n.unsubscribeUrl)}" style="color:${SOFT}">Stop these emails</a>.` : "";

export function eventNotificationEmail(n: EventNotificationData): Body {
  if (n.notice === "cancelled") return cancelledEventEmail(n);
  if (n.notice === "updated") return updatedEventEmail(n);
  if (n.notice === "reminder") return reminderEmail(n);
  if (n.notice === "short") return shortSlotsEmail(n);
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
  const when = fmtEventWhen(n);
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
      ? `${n.circleName}'s members consented to this meeting, so it's scheduled. RSVP if you're coming.`
      : proposal
    ? `${n.organizerName} proposed this for ${n.circleName}. It needs ${n.votesNeeded} approving vote${n.votesNeeded === 1 ? "" : "s"} from ${because} members before it opens up to ${n.circleName}.`
    : approvedEvent && n.approvedByRole
      ? `${n.organizerName}, ${n.hostCircleName ?? "the circle"}'s ${n.approvedByRole}, approved this event, so it's now open to everyone in ${n.circleName}.`
    : approvedEvent
      ? `${n.hostCircleName ?? "A circle"}'s members consented to this event, so it's now open to everyone in ${n.circleName}.`
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
// a post a Circle put on the reader's neighborhood's bulletin
export interface DigestPostData {
  title: string;
  // what kind it is ("Announcement", "Survey"…), over it
  kindLabel: string;
  url?: string;
  message?: string;
  circleName: string;
  neighborhoodName: string;
  posterName?: string;
  // the neighborhood's page, where the bulletin is
  pageUrl: string;
}

// something the reader's neighborhood is asked to decide (a new Circle in it)
export interface DigestProposalData {
  title: string;
  neighborhoodName: string;
  proposerName: string;
  closesAt: Date;
  url: string;
}

/* The daily digest: a neighborhood's news (posts on its bulletin, then what
   it's asked to decide) above the events, which are grouped as before. */
export function digestEmail({ events, posts = [], proposals = [] }: { events: DigestEventData[]; posts?: DigestPostData[]; proposals?: DigestProposalData[] }): Body {
  const count = events.length + posts.length + proposals.length;
  const groupOf = (e: DigestEventData) => (e.notice === "proposed" ? (e.hostCircleName ?? e.circleName) : e.circleName);
  const groups = new Map<string, DigestEventData[]>();
  for (const e of [...events].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))) {
    groups.set(groupOf(e), [...(groups.get(groupOf(e)) ?? []), e]);
  }
  const circleNames = [...groups.keys()].sort((a, b) => a.localeCompare(b));
  // "3 new events" while that's all it is; "3 updates" once it mixes in votes to
  // cast or meetings approved
  const allNew = posts.length === 0 && proposals.length === 0 && events.every((e) => e.notice === "new");
  const heading = allNew ? `${count} new event${count === 1 ? "" : "s"}` : `${count} update${count === 1 ? "" : "s"}`;
  const meta = (e: DigestEventData) => `${fmtEventWhen(e)} · ${e.location}`;
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
  const base = events[0]?.url.replace(/\/events\/.*$/, "") ?? posts[0]?.pageUrl.replace(/\/circles\/.*$/, "") ?? proposals[0]?.url.replace(/\/proposals\/.*$/, "") ?? "";
  const openAll = `${base}/events`;
  const neighborhoods = [...new Set([...posts.map((p) => p.neighborhoodName), ...proposals.map((p) => p.neighborhoodName)])];
  const why = `You're getting this because you're a member of ${[...new Set([...neighborhoods, ...circleNames])].sort((a, b) => a.localeCompare(b)).join(", ")}.`;
  const postBy = (p: DigestPostData) => `From ${p.circleName}${p.posterName ? `, posted by ${p.posterName}` : ""}`;
  const proposalBy = (p: DigestProposalData) => `Proposed by ${p.proposerName}. Answer by ${fmtDateTime(p.closesAt)}; if no one objects, it goes ahead.`;
  const neighborhoodText =
    (posts.length > 0
      ? `${neighborhoods.length === 1 ? `${neighborhoods[0]!.toUpperCase()}'S` : "YOUR NEIGHBORHOOD'S"} BULLETIN\n` +
        posts.map((p) => `- ${p.title}\n  ${postBy(p)}${p.message ? `\n\n  ${p.message.replace(/\n/g, "\n  ")}` : ""}\n  ${p.url ?? p.pageUrl}`).join("\n\n") +
        "\n\n"
      : "") +
    (proposals.length > 0
      ? `FOR YOUR NEIGHBORHOOD TO DECIDE\n` + proposals.map((p) => `- ${p.title} (${p.neighborhoodName})\n  ${proposalBy(p)}\n  ${p.url}`).join("\n\n") + "\n\n"
      : "");

  const text =
    `Your Circles digest — ${heading}\n\n` +
    neighborhoodText +
    circleNames
      .map((c) =>
        `${c.toUpperCase()}\n` +
        groups
          .get(c)!
          .map((e) => `- ${e.title}${label(e) ? ` (${label(e)!.text.toLowerCase()})` : ""}\n  ${meta(e)}\n  ${by(e)}\n  ${e.url}`)
          .join("\n\n")
      )
      .join("\n\n") +
    (events.length > 0 ? `\n\nSee all events: ${openAll}` : "") +
    `\n\n${why}`;

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

  const section = (title: string) => `<tr><td style="padding-top:26px"><div style="border-bottom:1px solid ${INK};padding-bottom:8px;margin-bottom:16px">${eyebrow(esc(title))}</div></td></tr>`;
  const postRow = (p: DigestPostData) =>
    `<tr><td style="padding:0 0 20px">` +
    eyebrow(p.kindLabel) +
    `<div style="height:3px"></div>` +
    (p.url
      ? `<a href="${esc(p.url)}" style="font-family:${SANS};font-size:18px;font-weight:700;line-height:1.25;color:${INK};text-decoration:underline">${esc(p.title)}</a>`
      : `<div style="font-family:${SANS};font-size:18px;font-weight:700;line-height:1.25;color:${INK}">${esc(p.title)}</div>`) +
    (p.message ? `<div style="margin-top:6px;font-family:${SERIF};font-size:16px;line-height:1.5;color:#222222">${esc(p.message).replace(/\n/g, "<br>")}</div>` : "") +
    `<div style="margin-top:4px;font-family:${SERIF};font-size:15px;line-height:1.45;color:${SOFT}">${esc(postBy(p))}</div>` +
    `</td></tr>`;
  const proposalRow = (p: DigestProposalData) =>
    `<tr><td style="padding:0 0 18px">` +
    eyebrow("Proposal · Your answer is asked", FLAME) +
    `<div style="height:3px"></div>` +
    `<a href="${esc(p.url)}" style="font-family:${SANS};font-size:18px;font-weight:700;line-height:1.25;color:${INK};text-decoration:underline">${esc(p.title)}</a>` +
    `<div style="margin-top:3px;font-family:${SERIF};font-size:15px;line-height:1.45;color:${SOFT}">${esc(proposalBy(p))}</div>` +
    `</td></tr>`;

  return {
    subject: `Circles digest: ${heading}`,
    text,
    html: shell(
      `<tr><td style="border-top:3px solid ${INK};padding-top:18px">` +
        eyebrow("Your daily digest") +
        `<div style="margin-top:10px;font-family:${SANS};font-size:32px;font-weight:800;letter-spacing:-0.035em;line-height:1;color:${INK}">${heading}</div>` +
        `</td></tr>` +
        (posts.length > 0 ? section(neighborhoods.length === 1 ? `${neighborhoods[0]}'s bulletin` : "Your neighborhood's bulletin") + posts.map(postRow).join("") : "") +
        (proposals.length > 0 ? section("For your neighborhood to decide") + proposals.map(proposalRow).join("") : "") +
        circleNames
          .map(
            (c) =>
              `<tr><td style="padding-top:26px"><div style="border-bottom:1px solid ${INK};padding-bottom:8px;margin-bottom:16px">${eyebrow(esc(c))}</div></td></tr>` +
              groups.get(c)!.map(row).join("")
          )
          .join("") +
        (events.length > 0
          ? `<tr><td style="padding:10px 0 28px"><a href="${esc(openAll)}" style="display:inline-block;background:${INK};color:#ffffff;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;padding:14px 22px">See all events</a></td></tr>`
          : `<tr><td style="padding-bottom:12px"></td></tr>`) +
        `<tr><td style="border-top:1px solid ${FAINT};padding-top:16px;font-family:${SERIF};font-size:14px;line-height:1.5;color:${SOFT}">${esc(why)}</td></tr>`
    ),
  };
}

/* To someone who was going: the organizer called it off. The facts they'd
   planned around (when, where) are repeated so they know which event it was,
   and there's no call to act on beyond seeing it in the app. */
function cancelledEventEmail(n: EventNotificationData): Body {
  const noun = n.kind === "meeting" ? "meeting" : "event";
  const when = fmtEventWhen(n);
  // a date of a repeating event is cancelled alone, or with every later date
  // (its series then ends before it)
  const note = n.cancelledAutomatically
    ? `This ${noun} was cancelled automatically, since no one signed up as ${listOf(shortLabels(n)) || "a required role"} by 15 minutes before the start.`
    : !n.repeat
    ? `${n.organizerName} cancelled this ${noun}, so it won't be going ahead.`
    : endedBefore(n.repeat, n.date)
      ? `${n.organizerName} cancelled this ${n.repeat.frequency} ${noun} from this date on, so neither this date nor any after it will be going ahead.`
      : `${n.organizerName} cancelled this date of a ${n.repeat.frequency} ${noun}. The other dates are still on.`;
  // an automatic cancellation also tells its host, who may not have been going
  const why = n.cancelledAutomatically ? `You're getting this because you were going to it or help host it.` : `You're getting this because you were going to it.`;
  const detail = (label: string, value: string) =>
    `<tr><td style="padding-bottom:14px">${eyebrow(label)}<div style="margin-top:4px;font-family:${SERIF};font-size:18px;line-height:1.4;color:${INK}">${esc(value)}</div></td></tr>`;
  return {
    subject: `Cancelled: ${n.title}`,
    text: `Cancelled ${noun} in ${n.circleName}\n\n${n.title}\n\n${note}\n\nWas: ${when}\nWhere: ${n.location}\n\nView it: ${n.url}\n\n${why}${stopText(n)}`,
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
        `<tr><td style="border-top:1px solid ${FAINT};padding-top:16px;font-family:${SERIF};font-size:14px;line-height:1.5;color:${SOFT}">${esc(why)}${stopHtml(n)}</td></tr>`
    ),
  };
}

// which of an event's when and where differ from what an "updated" notice
// remembers — all false once an edit has been undone, and nothing need be sent
export function eventChanges(n: Pick<EventNotificationData, "date" | "start" | "end" | "location" | "change">) {
  const was = n.change?.was;
  return {
    date: !!was && was.date !== n.date,
    time: !!was && (was.start !== n.start || was.end !== n.end),
    location: !!was && was.location !== n.location,
  };
}

/* To someone who's going: the organizer moved it — a new date, time or place.
   Each detail that changed shows what it was beneath it, struck through. */
function updatedEventEmail(n: EventNotificationData): Body {
  const noun = n.kind === "meeting" ? "meeting" : "event";
  const changed = eventChanges(n);
  const parts = [changed.date && "date", changed.time && "time", changed.location && "location"].filter((p): p is string => !!p);
  const what = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : (parts[0] ?? "details");
  const note =
    n.change?.andLater && n.repeat
      ? `${n.organizerName} changed the ${what} of this ${n.repeat.frequency} ${noun}, from this date on.`
      : `${n.organizerName} changed the ${what} of this ${noun}.`;
  const why = `You're getting this because you're going to it.`;
  const when = fmtEventWhen(n);
  const was = n.change?.was;
  const wasWhen = was && (changed.date || changed.time) ? fmtEventWhen(was) : "";
  const wasWhere = was && changed.location ? was.location : "";
  const detail = (label: string, value: string, before: string) =>
    `<tr><td style="padding-bottom:14px">${eyebrow(before ? `${label} · changed` : label, before ? INK : SOFT)}` +
    `<div style="margin-top:4px;font-family:${SERIF};font-size:18px;line-height:1.4;color:${INK}">${esc(value)}</div>` +
    (before ? `<div style="margin-top:2px;font-family:${SERIF};font-size:15px;line-height:1.4;color:${SOFT};text-decoration:line-through">${esc(before)}</div>` : "") +
    `</td></tr>`;
  return {
    subject: `Changed: ${n.title}`,
    text:
      `Changed ${noun} in ${n.circleName}\n\n${n.title}\n\n${note}\n\n` +
      `When: ${when}\n${wasWhen ? `  (was ${wasWhen})\n` : ""}Where: ${n.location}\n${wasWhere ? `  (was ${wasWhere})\n` : ""}\n` +
      `View it: ${n.url}\n\n${why}${stopText(n)}`,
    html: shell(
      `<tr><td style="border-top:3px solid ${INK};padding-top:18px">` +
        eyebrow(`Changed ${noun} · ${esc(n.circleName)}`) +
        `<div style="margin-top:10px;font-family:${SANS};font-size:32px;font-weight:800;letter-spacing:-0.035em;line-height:1;color:${INK}">${esc(n.title)}</div>` +
        `</td></tr>` +
        `<tr><td style="padding-top:20px"><div style="border-left:3px solid ${INK};padding-left:12px;font-family:${SERIF};font-size:16px;line-height:1.5;color:#222222">${esc(note)}</div></td></tr>` +
        `<tr><td style="padding:24px 0 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">` +
        detail("When", when, wasWhen) +
        detail("Where", n.location, wasWhere) +
        `</table></td></tr>` +
        `<tr><td style="padding-bottom:28px"><a href="${esc(n.url)}" style="display:inline-block;background:${INK};color:#ffffff;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;padding:14px 22px">View event</a></td></tr>` +
        `<tr><td style="border-top:1px solid ${FAINT};padding-top:16px;font-family:${SERIF};font-size:14px;line-height:1.5;color:${SOFT}">${esc(why)}${stopHtml(n)}</td></tr>`
    ),
  };
}

/* To someone going: it's coming up within a day. The when and where again,
   their own slot if they hold one, and — where it can still make a difference
   — the slots still short of people, since an event whose required slot is
   empty 15 minutes before it starts is cancelled (lib/roles.util.ts). */
function reminderEmail(n: EventNotificationData): Body {
  const noun = n.kind === "meeting" ? "meeting" : "event";
  const dayWord = relativeDayWord(n.date, n.today);
  const at = `${dayWord} at ${fmtTime(n.start)}`;
  const mine = n.mySlots ?? [];
  const note = mine.length > 0
    ? `You're signed up as ${listOf(mine)} for this ${noun}, ${at}.`
    : `You're going to this ${noun}, ${at}.`;
  const open = n.openSlots ?? [];
  const openLines = open.map((s) => `${s.label}: ${s.filled} of ${s.min} needed`);
  const openNote = "If a required role is still empty 15 minutes before the start, the event is cancelled automatically.";
  const Day = dayWord.charAt(0).toUpperCase() + dayWord.slice(1);
  const why = `You're getting this because you're going to it.`;
  const when = fmtEventWhen(n);
  const agenda = n.agenda ?? [];
  const detail = (label: string, value: string) =>
    `<tr><td style="padding-bottom:14px">${eyebrow(label)}<div style="margin-top:4px;font-family:${SERIF};font-size:18px;line-height:1.4;color:${INK}">${esc(value)}</div></td></tr>`;
  const host: [string, string] = n.hostCircleName ? ["Hosted by", n.hostCircleName] : [n.approvedByRole && n.kind === "meeting" ? "Scheduled by" : n.kind === "meeting" ? "Proposed by" : "Hosted by", n.organizerName];
  return {
    subject: `${Day} at ${fmtTime(n.start)}: ${n.title}`,
    text:
      `Reminder: ${n.title}\n\n${note}\n\n` +
      `When: ${when}\nWhere: ${n.location}\n${host[0]}: ${host[1]}\n\n` +
      (openLines.length > 0 ? `Still short of people:\n${openLines.map((l) => `- ${l}`).join("\n")}\n${openNote}\n\n` : "") +
      (agenda.length > 0 ? `Agenda:\n${agendaText(agenda)}\n\n` : "") +
      `View it: ${n.url}\n\n${why}`,
    html: shell(
      `<tr><td style="border-top:3px solid ${INK};padding-top:18px">` +
        eyebrow(`Reminder · ${esc(n.circleName)}`) +
        `<div style="margin-top:10px;font-family:${SANS};font-size:32px;font-weight:800;letter-spacing:-0.035em;line-height:1;color:${INK}">${esc(n.title)}</div>` +
        `</td></tr>` +
        `<tr><td style="padding-top:20px"><div style="border-left:3px solid ${INK};padding-left:12px;font-family:${SERIF};font-size:16px;line-height:1.5;color:#222222">${esc(note)}</div></td></tr>` +
        `<tr><td style="padding:24px 0 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">` +
        detail("When", when) +
        detail("Where", n.location) +
        detail(host[0], host[1]) +
        `</table></td></tr>` +
        // the app's "needs slots" warning: yellow, with what each slot is short
        (openLines.length > 0
          ? `<tr><td style="padding-bottom:24px"><div style="border-left:3px solid ${WARNING};padding-left:12px">` +
            eyebrow("Still short of people", INK) +
            `<div style="margin-top:6px;font-family:${SERIF};font-size:16px;line-height:1.5;color:#222222">${openLines.map(esc).join("<br>")}</div>` +
            `<div style="margin-top:6px;font-family:${SERIF};font-size:14px;line-height:1.5;color:${SOFT}">${openNote}</div>` +
            `</div></td></tr>`
          : "") +
        (agenda.length > 0 ? agendaHtml(agenda) : "") +
        `<tr><td style="padding-bottom:28px"><a href="${esc(n.url)}" style="display:inline-block;background:${INK};color:#ffffff;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;padding:14px 22px">View event</a></td></tr>` +
        `<tr><td style="border-top:1px solid ${FAINT};padding-top:16px;font-family:${SERIF};font-size:14px;line-height:1.5;color:${SOFT}">${esc(why)}</td></tr>`
    ),
  };
}

// the required slots still short, by name ("Leader")
const shortLabels = (n: Pick<EventNotificationData, "openSlots">) => (n.openSlots ?? []).map((s) => s.label);

/* To an event's host (its organizer, and a host circle's members): an hour
   before the start, a required slot is still short, so they can reach out to
   someone who could cover it before it's cancelled automatically. The yellow
   of the app's at-risk banner: a heads-up, not a decision. */
function shortSlotsEmail(n: EventNotificationData): Body {
  const needs = listOf(shortLabels(n).map(withArticle)) || "someone in a required role";
  const lines = (n.openSlots ?? []).map((s) => `${s.label}: ${s.filled} of ${s.min} needed`);
  const note = n.autoCancel
    ? `${n.title} starts at ${fmtTime(n.start)} and still needs ${needs}. If no one signs up by ${autoCancelClock(n.start)}, it's cancelled automatically and everyone going is told.`
    : `${n.title} starts at ${fmtTime(n.start)} and still needs ${needs}.`;
  const ask = "Know someone who could cover it? They can sign up on the event's page.";
  const why = n.hostCircleName ? `You're getting this because you're a member of ${n.hostCircleName}, which hosts it.` : `You're getting this because you're hosting it.`;
  const when = fmtEventWhen(n);
  const detail = (label: string, value: string) =>
    `<tr><td style="padding-bottom:14px">${eyebrow(label)}<div style="margin-top:4px;font-family:${SERIF};font-size:18px;line-height:1.4;color:${INK}">${esc(value)}</div></td></tr>`;
  return {
    subject: `Needs ${needs}: ${n.title}`,
    text:
      `Still short: ${n.title}\n\n${note}\n\n${ask}\n\n` +
      (lines.length > 0 ? `${lines.map((l) => `- ${l}`).join("\n")}\n\n` : "") +
      `When: ${when}\nWhere: ${n.location}\n\nView it: ${n.url}\n\n${why}`,
    html: shell(
      `<tr><td style="border-top:3px solid ${WARNING};padding-top:18px">` +
        eyebrow(`Still short · ${esc(n.hostCircleName ?? n.circleName)}`, INK) +
        `<div style="margin-top:10px;font-family:${SANS};font-size:32px;font-weight:800;letter-spacing:-0.035em;line-height:1;color:${INK}">${esc(n.title)}</div>` +
        `</td></tr>` +
        `<tr><td style="padding-top:20px"><div style="border-left:3px solid ${WARNING};padding-left:12px;font-family:${SERIF};font-size:16px;line-height:1.5;color:#222222">${esc(note)}<br><br>${esc(ask)}</div></td></tr>` +
        (lines.length > 0
          ? `<tr><td style="padding-top:20px">${eyebrow("Still short of people", INK)}<div style="margin-top:6px;font-family:${SERIF};font-size:16px;line-height:1.5;color:#222222">${lines.map(esc).join("<br>")}</div></td></tr>`
          : "") +
        `<tr><td style="padding:24px 0 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">` +
        detail("When", when) +
        detail("Where", n.location) +
        `</table></td></tr>` +
        `<tr><td style="padding-bottom:28px"><a href="${esc(n.url)}" style="display:inline-block;background:${WARNING};color:${INK};font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;padding:14px 22px">View event</a></td></tr>` +
        `<tr><td style="border-top:1px solid ${FAINT};padding-top:16px;font-family:${SERIF};font-size:14px;line-height:1.5;color:${SOFT}">${esc(why)}</td></tr>`
    ),
  };
}

export interface ProposalEmailData {
  // which email this is: it's open for an answer, or how it ended
  notice: ProposalNoticeKind;
  proposalId: string;
  kind: ProposalKind;
  // whose members decide it; for a change its neighborhood decides too, the
  // circle it would change
  circleName: string;
  subjectCircleName?: string;
  changes: ProposalChanges;
  lines: ProposalLine[];
  closesAt: Date;
  proposerName: string;
  // an "objected" notice's: who objected, and why
  objectorName?: string;
  reason?: string;
  url: string;
}

const lineText = (l: ProposalLine) => (l.before && l.after ? `${l.label}: ${l.before} → ${l.after}` : l.after ? `${l.label}: ${l.after}` : l.label);

/* A proposal to change a circle, to its members (see lib/proposals.util.ts):
   that it's open for their answer, that someone objected (with why), or that
   it passed. Each lists what it changes, before and after. */
export function proposalEmail(d: ProposalEmailData): Body {
  const title = proposalTitle(d);
  // a group's event, proposed for its consent, rather than a change to the circle
  const event = isEventProposal(d);
  const deadline = fmtDateTime(d.closesAt);
  const { made, ask, passed } = proposalWords(d);
  const [subject, eyebrowText, accent, note, action] =
    d.notice === "opened"
      ? [
          `Proposal for ${d.circleName}: ${title}`,
          `Proposal · ${d.circleName}`,
          INK,
          `${d.proposerName} proposes ${ask}. Say whether you like it, accept it, or object, by ${deadline}. If no one objects, it's ${made} then.`,
          "Respond",
        ]
      : d.notice === "objected"
        ? [
            `Objection: ${title}`,
            `Objected · ${d.circleName}`,
            DANGER,
            `${d.objectorName ?? "A member"} objected to ${d.proposerName}'s proposal, so it won't be ${event ? "held" : made}.${d.reason ? ` Their reason: “${d.reason}”.` : ""} It can be proposed again, changed to meet the objection.`,
            "View proposal",
          ]
        : [`Passed: ${title}`, `Passed · ${d.circleName}`, LEAF, `No one objected to ${d.proposerName}'s proposal, so ${passed}.`, "View proposal"];
  const why = `You're getting this because you're a member of ${d.subjectCircleName ?? d.circleName}${d.kind === "new_circle" ? ", or proposed it" : ""}.`;
  const line = (l: ProposalLine) =>
    `<tr><td style="padding-bottom:14px">${eyebrow(esc(l.label))}` +
    (l.after ? `<div style="margin-top:4px;font-family:${SERIF};font-size:18px;line-height:1.4;color:${INK}">${esc(l.after).replace(/\n/g, "<br>")}</div>` : "") +
    (l.before ? `<div style="margin-top:2px;font-family:${SERIF};font-size:15px;line-height:1.4;color:${SOFT};text-decoration:line-through">${esc(l.before)}</div>` : "") +
    `</td></tr>`;
  return {
    subject,
    text: `${title}\n\n${note}\n\n${d.lines.map((l) => `- ${lineText(l)}`).join("\n")}\n\n${action}: ${d.url}\n\n${why}`,
    html: shell(
      `<tr><td style="border-top:3px solid ${accent};padding-top:18px">` +
        eyebrow(esc(eyebrowText), accent === INK ? SOFT : accent) +
        `<div style="margin-top:10px;font-family:${SANS};font-size:32px;font-weight:800;letter-spacing:-0.035em;line-height:1;color:${INK}">${esc(title)}</div>` +
        `</td></tr>` +
        `<tr><td style="padding-top:20px"><div style="border-left:3px solid ${accent};padding-left:12px;font-family:${SERIF};font-size:16px;line-height:1.5;color:#222222">${esc(note)}</div></td></tr>` +
        `<tr><td style="padding:24px 0 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${d.lines.map(line).join("")}</table></td></tr>` +
        `<tr><td style="padding-bottom:28px"><a href="${esc(d.url)}" style="display:inline-block;background:${INK};color:#ffffff;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;padding:14px 22px">${action}</a></td></tr>` +
        `<tr><td style="border-top:1px solid ${FAINT};padding-top:16px;font-family:${SERIF};font-size:14px;line-height:1.5;color:${SOFT}">${esc(why)}</td></tr>`
    ),
  };
}

/* What a proposal asks, and what becomes of it, in words for its kind: a
   change to a circle (one its neighborhood decides too, when it becomes a
   Circle there), an event the circle would hold, a post to its
   neighborhood's bulletin, or a new Circle. */
export function proposalWords(d: Pick<ProposalEmailData, "kind" | "circleName" | "subjectCircleName" | "changes">): { made: string; ask: string; passed: string } {
  if (d.kind === "event") return { made: "scheduled", ask: `that ${d.circleName} hold this event, which needs its members' consent`, passed: "the event has been scheduled" };
  if (d.kind === "post") return { made: "posted", ask: `that ${d.circleName} post this to its neighborhood's bulletin, which needs its members' consent`, passed: "it's now on the neighborhood's bulletin" };
  if (d.kind === "new_circle") {
    const name = d.changes.name ?? "a new Circle";
    return { made: "started", ask: `starting ${name}, a Circle in ${d.circleName}, which needs the consent of everyone who lives there`, passed: `${name} has been started` };
  }
  if (d.subjectCircleName) {
    return { made: "made", ask: `a change to ${d.subjectCircleName}, which needs the consent of its members and of everyone in ${d.circleName}`, passed: `the change has been made to ${d.subjectCircleName}` };
  }
  return { made: "made", ask: `a change to ${d.circleName}, which needs its members' consent`, passed: `the change has been made to ${d.circleName}` };
}

export interface AnnouncementEmailData {
  circleName: string;
  title: string;
  message: string;
  // who posted it, when that's still known
  posterName?: string;
  createdAt: Date;
  // the circle's page, where a member lands on its bulletin
  url: string;
}

/* An announcement posted to a circle's bulletin, sent whole to its members —
   it's a message written for them to read, so there's nothing to click
   through to for the rest. Dressed like the bulletin's announcement card: a
   red rule along the top, the message, and the poster's signature. */
export function announcementEmail(a: AnnouncementEmailData): Body {
  const date = fmtNumericDate(a.createdAt.toISOString());
  const signature = a.posterName ? `— ${a.posterName} on ${date}` : `— ${date}`;
  const why = `You're getting this because you're a member of ${a.circleName}.`;
  return {
    subject: `${a.circleName}: ${a.title}`,
    text: `Announcement in ${a.circleName}\n\n${a.title}\n\n${a.message}\n\n${signature}\n\nSee the bulletin: ${a.url}\n\n${why}`,
    html: shell(
      `<tr><td style="border-top:3px solid ${ANNOUNCEMENT};padding-top:18px">` +
        eyebrow(`Announcement · ${esc(a.circleName)}`, ANNOUNCEMENT) +
        `<div style="margin-top:10px;font-family:${SANS};font-size:32px;font-weight:800;letter-spacing:-0.035em;line-height:1;color:${INK}">${esc(a.title)}</div>` +
        `</td></tr>` +
        `<tr><td style="padding-top:20px;font-family:${SERIF};font-size:18px;line-height:1.55;color:#222222">${esc(a.message).replace(/\n/g, "<br>")}</td></tr>` +
        `<tr><td style="padding:14px 0 28px;font-family:${SERIF};font-size:15px;font-style:italic;color:${SOFT}">${esc(signature)}</td></tr>` +
        `<tr><td style="padding-bottom:28px"><a href="${esc(a.url)}" style="display:inline-block;background:${INK};color:#ffffff;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;padding:14px 22px">See the bulletin</a></td></tr>` +
        `<tr><td style="border-top:1px solid ${FAINT};padding-top:16px;font-family:${SERIF};font-size:14px;line-height:1.5;color:${SOFT}">${esc(why)}</td></tr>`
    ),
  };
}

// "a", "a and b", "a, b and c"
const listOf = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}` : (items[0] ?? ""));

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

// confirms a guest's email is really theirs, before their name joins an event's list
export function guestRsvpCodeEmail(code: string, minutes: number, eventTitle: string): Body {
  const expiry = `Enter it on the event page to RSVP to ${eventTitle}. It expires in ${minutes} minutes.`;
  const ignore = `If you didn't ask to RSVP, you can ignore this email — nothing happens without this code.`;
  return {
    subject: `Confirm your RSVP to ${eventTitle}`,
    text: `Confirm your RSVP\n\n    ${code}\n\n${expiry}\n\n${ignore}`,
    html: shell(
      applicationMasthead("Confirm your RSVP on") +
        `<tr><td style="padding:28px 0 24px"><div style="border:2px solid ${INK};padding:26px 16px 26px 24px;text-align:center;font-family:${SANS};font-size:52px;font-weight:800;letter-spacing:0.16em;line-height:1;color:${INK}">${code}</div></td></tr>` +
        paragraph(esc(expiry)) +
        footnote(ignore)
    ),
  };
}

/* To someone who RSVPed from a share link: the facts they'd plan around, and
   where to see the event again. Their updates and cancellation reuse the
   member emails; only this one is theirs alone. */
function guestConfirmedEmail(n: EventNotificationData & { guestName: string }): Body {
  const noun = n.kind === "meeting" ? "meeting" : "event";
  const when = fmtEventWhen(n);
  const note = `You're going to this ${noun}, ${n.guestName.trim().split(/\s+/)[0]}. We've put your name on the list.`;
  const why = `You're getting this because you RSVPed to it.`;
  const detail = (label: string, value: string) =>
    `<tr><td style="padding-bottom:14px">${eyebrow(label)}<div style="margin-top:4px;font-family:${SERIF};font-size:18px;line-height:1.4;color:${INK}">${esc(value)}</div></td></tr>`;
  return {
    subject: `You're going: ${n.title}`,
    text: `You're going\n\n${n.title}\n\n${note}\n\nWhen: ${when}\nWhere: ${n.location}\n\nSee it: ${n.url}\n\n${why}${stopText(n)}`,
    html: shell(
      `<tr><td style="border-top:3px solid ${LEAF};padding-top:18px">` +
        eyebrow("You're going", LEAF) +
        `<div style="margin-top:10px;font-family:${SANS};font-size:32px;font-weight:800;letter-spacing:-0.035em;line-height:1;color:${INK}">${esc(n.title)}</div>` +
        `</td></tr>` +
        `<tr><td style="padding-top:20px"><div style="border-left:3px solid ${LEAF};padding-left:12px;font-family:${SERIF};font-size:16px;line-height:1.5;color:#222222">${esc(note)}</div></td></tr>` +
        `<tr><td style="padding:24px 0 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">` +
        detail("When", when) +
        detail("Where", n.location) +
        `</table></td></tr>` +
        `<tr><td style="padding-bottom:28px"><a href="${esc(n.url)}" style="display:inline-block;background:${INK};color:#ffffff;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;padding:14px 22px">See the event</a></td></tr>` +
        `<tr><td style="border-top:1px solid ${FAINT};padding-top:16px;font-family:${SERIF};font-size:14px;line-height:1.5;color:${SOFT}">${esc(why)}${stopHtml(n)}</td></tr>`
    ),
  };
}

// what a guest is emailed about the event they RSVPed to
export function guestEmail(n: Omit<EventNotificationData, "notice"> & { notice: GuestNoticeKind; guestName: string }): Body {
  if (n.notice === "confirmed") return guestConfirmedEmail({ ...n, notice: "new" });
  return eventNotificationEmail({ ...n, notice: n.notice });
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

// a system admin's decision on the new photo a member sent
export function photoDecisionEmail(d: { name: string; approved: boolean; note?: string; url: string }): Body {
  const body = d.approved
    ? "Your new photo has been approved, and your neighbors now see it on your profile."
    : "Your new photo wasn't approved, so your profile keeps the photo it had. You're welcome to send another.";
  const noteLabel = "A note from the reviewer";
  return {
    subject: d.approved ? "Your new photo is up" : "About your new photo",
    text: `${d.name},\n\n${body}\n\n${d.note ? `${noteLabel}:\n${d.note}\n\n` : ""}Your profile: ${d.url}`,
    html: shell(
      applicationMasthead("Your new photo on") +
        `<tr><td style="padding-top:24px"></td></tr>` +
        paragraph(`${esc(d.name)}, ${esc(body)}`) +
        (d.note
          ? `<tr><td style="padding-bottom:20px">${eyebrow(noteLabel)}<div style="margin-top:8px;border-left:3px solid ${INK};padding-left:12px;font-family:${SERIF};font-size:16px;line-height:1.5;color:#222222">${esc(d.note).replace(/\n/g, "<br>")}</div></td></tr>`
          : "") +
        `<tr><td style="padding-bottom:28px"><a href="${esc(d.url)}" style="display:inline-block;background:${INK};color:#ffffff;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;padding:14px 22px">${d.approved ? "See your profile" : "Choose another"}</a></td></tr>`
    ),
  };
}

// someone gave you one of a circle's tasks
export function taskAssignedEmail(d: { name: string; assignerName?: string; circleName: string; title: string; due?: string; url: string }): Body {
  const who = d.assignerName ?? "A member";
  const lead = `${who} gave you a task in ${d.circleName}${d.due ? `, ${d.due.charAt(0).toLowerCase()}${d.due.slice(1)}` : ""}.`;
  const why = `You're getting this because you're a member of ${d.circleName}.`;
  return {
    subject: `${who} gave you a task: ${d.title}`,
    text: `${d.name},\n\n${lead}\n\n${d.title}\n\nOpen it: ${d.url}\n\n${why}`,
    html: shell(
      `<tr><td style="border-top:3px solid ${INK};padding-top:18px">` +
        eyebrow(`A task in ${esc(d.circleName)}`) +
        `<div style="margin-top:10px;font-family:${SANS};font-size:32px;font-weight:800;letter-spacing:-0.035em;line-height:1.05;color:${INK}">${esc(d.title)}</div>` +
        `</td></tr>` +
        `<tr><td style="padding-top:24px"></td></tr>` +
        paragraph(`${esc(d.name)}, ${esc(lead)}`) +
        `<tr><td style="padding-bottom:28px"><a href="${esc(d.url)}" style="display:inline-block;background:${INK};color:#ffffff;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;padding:14px 22px">Open the task</a></td></tr>` +
        footnote(esc(why))
    ),
  };
}

// a member invited you to join their circle
export function invitationEmail(d: { name: string; inviterName?: string; circleName: string; tagline: string; url: string }): Body {
  const who = d.inviterName ?? "A member";
  const lead = `${who} invited you to join ${d.circleName}.`;
  const after = "Accept it in the app to become a member — you'll see its bulletin and events. It's also waiting on your Home page.";
  const why = `You're getting this because ${who} invited you on Circles.`;
  return {
    subject: `${who} invited you to join ${d.circleName}`,
    text: `${d.name},\n\n${lead}${d.tagline ? `\n\n${d.circleName}: ${d.tagline}` : ""}\n\n${after}\n\nView the invitation: ${d.url}\n\n${why}`,
    html: shell(
      `<tr><td style="border-top:3px solid ${INK};padding-top:18px">` +
        eyebrow("Invitation to join") +
        `<div style="margin-top:10px;font-family:${SANS};font-size:32px;font-weight:800;letter-spacing:-0.035em;line-height:1;color:${INK}">${esc(d.circleName)}</div>` +
        (d.tagline ? `<div style="margin-top:12px;font-family:${SERIF};font-size:18px;font-style:italic;line-height:1.4;color:#222222">${esc(d.tagline)}</div>` : "") +
        `</td></tr>` +
        `<tr><td style="padding-top:24px"></td></tr>` +
        paragraph(`${esc(d.name)}, ${esc(lead)} ${esc(after)}`) +
        `<tr><td style="padding-bottom:28px"><a href="${esc(d.url)}" style="display:inline-block;background:${INK};color:#ffffff;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;padding:14px 22px">View invitation</a></td></tr>` +
        footnote(esc(why))
    ),
  };
}
