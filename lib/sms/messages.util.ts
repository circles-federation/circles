import type { PushMessage } from "@/lib/push";
import type { DigestEventData } from "@/lib/email/templates.util";
import { fmtEventWhen } from "@/lib/format.util";

/* The app's texts, as pure functions from data to a message body — the
   counterparts of lib/email/templates.util.ts and lib/push/messages.util.ts.
   A notification's text says what its push says (the same few words, written
   once, in lib/push/messages.util.ts) with the link spelled out, since a text
   can't be tapped into the app any other way. Each starts with "Circles:", as
   carriers want a sender named.

   A text is billed by the segment: 160 characters, but only 70 once anything
   outside the GSM alphabet appears — a curly quote or a "·" is enough. So the
   app's own punctuation is swapped for plain characters (gsm), which keeps
   most texts at two segments or fewer. What members type, an emoji in a
   title, still goes as it is. */

const GSM_SWAPS: [RegExp, string][] = [
  [/[‘’]/g, "'"],
  [/[“”]/g, '"'],
  [/[–—]/g, "-"],
  [/…/g, "..."],
  [/·/g, "-"],
  [/ /g, " "],
];

export function gsm(text: string): string {
  return GSM_SWAPS.reduce((t, [from, to]) => t.replace(from, to), text);
}

// confirming a number is theirs, when applying or adding it in Settings
export function phoneCodeText(code: string, minutes: number): string {
  return `Your Circles code is ${code}. It expires in ${minutes} minutes. Reply STOP to opt out.`;
}

// a notification's push as a text, its path made a whole link to the app
export function textFromPush(push: PushMessage, appUrl: string): string {
  return gsm(`Circles: ${push.title}\n${push.body}\n${appUrl}${push.url}`);
}

const DIGEST_LINES = 3;

/* The daily digest by text: how much there is, the first few events by title
   and time, and a link to the rest. The email has the detail; this is enough
   to know whether to look. */
export function digestText(events: DigestEventData[], appUrl: string): string {
  const count = events.length;
  const allNew = events.every((e) => e.notice === "new");
  const heading = allNew ? `${count} new event${count === 1 ? "" : "s"}` : `${count} update${count === 1 ? "" : "s"}`;
  const soonest = [...events].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  const lines = soonest.slice(0, DIGEST_LINES).map((e) => `- ${e.notice === "proposed" ? "Vote: " : ""}${e.title}, ${fmtEventWhen(e)}`);
  const more = count > DIGEST_LINES ? [`and ${count - DIGEST_LINES} more`] : [];
  return gsm([`Circles: ${heading} in your circles`, ...lines, ...more, `${appUrl}/events`].join("\n"));
}
