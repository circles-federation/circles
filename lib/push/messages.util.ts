import type { PushMessage } from "./index";
import { eventChanges, type EventNotificationData } from "@/lib/email/templates.util";
import { fmtEventWhen, fmtTime } from "@/lib/format.util";
import { endedBefore, relativeDayWord } from "@/lib/recurrence.util";

/* The app's push notifications, as pure functions from data to a message —
   the counterparts of lib/email/templates.util.ts's emails, saying the same
   thing in the few words a lock screen shows: a title naming what happened
   and to which event, and one line of body with when, where, and anything
   asked of the reader. Everything else is a tap away, in the app. */

// what a lock screen shows before cutting a notification off
const TITLE_CHARS = 80;
const BODY_CHARS = 180;

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);
const line = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" · ");

function message(title: string, body: string, url: string, tag: string): PushMessage {
  return { title: clip(title, TITLE_CHARS), body: clip(body, BODY_CHARS), url, tag };
}

export type EventPushData = Omit<EventNotificationData, "url"> & { eventId: string };

/* An event's news, by notice — the same cases eventNotificationEmail tells
   apart. Tagged by event, so a newer notification about it (a change, then a
   reminder) replaces an older one still showing on the device. */
export function eventNotificationPush(n: EventPushData): PushMessage {
  const url = `/events/${n.eventId}`;
  const tag = `event-${n.eventId}`;
  const meeting = n.kind === "meeting";
  const noun = meeting ? "meeting" : "event";
  const when = fmtEventWhen(n);
  const repeats = n.repeat && `repeats ${n.repeat.frequency}`;

  if (n.notice === "cancelled") {
    const rest = n.repeat && endedBefore(n.repeat, n.date) ? "This date and the ones after it won't go ahead." : `${n.organizerName} called it off.`;
    return message(`Cancelled: ${n.title}`, `Was ${when}. ${rest}`, url, tag);
  }

  if (n.notice === "updated") {
    const changed = eventChanges(n);
    const moved = [(changed.date || changed.time) && when, changed.location && `at ${n.location}`].filter(Boolean).join(", ");
    const scope = n.change?.andLater && n.repeat ? " From this date on." : "";
    return message(`Changed: ${n.title}`, `Now ${moved || line(when, n.location)}.${scope}`, url, tag);
  }

  if (n.notice === "reminder") {
    const day = relativeDayWord(n.date, n.today);
    const Day = day.charAt(0).toUpperCase() + day.slice(1);
    const mine = n.mySlots ?? [];
    const short = (n.openSlots ?? []).map((s) => `${s.label} (${s.filled} of ${s.min})`);
    const body = line(
      mine.length > 0 && `Signed up as ${mine.join(", ")}`,
      n.location,
      short.length > 0 && `Still short: ${short.join(", ")}`
    );
    return message(`${Day} at ${fmtTime(n.start)}: ${n.title}`, body, url, tag);
  }

  if (n.notice === "approved") {
    return meeting
      ? message(`Meeting approved: ${n.title}`, line(n.circleName, when, n.location), url, tag)
      : message(`Approved: ${n.title}`, line(n.hostCircleName && `Hosted by ${n.hostCircleName}`, when, repeats), url, tag);
  }

  // a proposal still waiting on its host circle's votes (one approved since it
  // was queued goes out as an ordinary event, as its email does)
  if (n.notice === "proposed" && n.proposed && n.hostCircleName) {
    return message(`Vote: proposed event in ${n.hostCircleName}`, line(n.title, when, "vote to approve"), url, tag);
  }

  if (meeting) {
    const ask = n.approvedByRole ? "RSVP if you're coming" : `needs ${n.votesNeeded} vote${n.votesNeeded === 1 ? "" : "s"} to be held`;
    return message(`New meeting in ${n.circleName}`, line(n.title, when, ask), url, tag);
  }

  return message(`New ${noun} in ${n.circleName}`, line(n.title, when, n.location, repeats), url, tag);
}
