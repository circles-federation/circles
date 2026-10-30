import type { PushMessage } from "./index";
import { eventChanges, proposalWords, type EventNotificationData } from "@/lib/email/templates.util";
import { fmtDateTime, fmtEventWhen, fmtTime, withArticle } from "@/lib/format.util";
import { isEventProposal, proposalTitle } from "@/lib/proposals.util";
import type { ProposalChanges, ProposalKind, ProposalLine, ProposalNoticeKind } from "@/lib/types";
import { endedBefore, relativeDayWord } from "@/lib/recurrence.util";
import { autoCancelClock } from "@/lib/roles.util";
import { isReminder } from "@/lib/events.util";
import { messageText } from "@/lib/messages.util";

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

  const short = (n.openSlots ?? []).map((s) => s.label);

  if (n.notice === "cancelled") {
    const rest = n.cancelledAutomatically
      ? `No one signed up as ${short.join(" or ") || "a required role"} in time.`
      : n.repeat && endedBefore(n.repeat, n.date)
        ? "This date and the ones after it won't go ahead."
        : `${n.organizerName} called it off.`;
    return message(`Cancelled: ${n.title}`, `Was ${when}. ${rest}`, url, tag);
  }

  if (n.notice === "updated") {
    const changed = eventChanges(n);
    const moved = [(changed.date || changed.time) && when, changed.location && `at ${n.location}`].filter(Boolean).join(", ");
    const scope = n.change?.andLater && n.repeat ? " From this date on." : "";
    return message(`Changed: ${n.title}`, `Now ${moved || line(when, n.location)}.${scope}`, url, tag);
  }

  // to its host: a required slot is still short an hour before the start
  if (n.notice === "short") {
    const needs = short.map(withArticle).join(" and ") || "someone";
    const unless = n.autoCancel ? ` Cancels at ${autoCancelClock(n.start)} unless someone signs up.` : "";
    return message(`Needs ${needs}: ${n.title}`, `Starts at ${fmtTime(n.start)}.${unless} Know someone who could cover it?`, url, tag);
  }

  if (isReminder(n.notice)) {
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

/* A new announcement on a circle's bulletin: its title, and as much of the
   message as fits (the whole of it is on the bulletin, a tap away). */
export function announcementPush(a: { resourceId: string; circleId: string; circleName: string; title: string; message: string; posterName?: string }): PushMessage {
  const text = a.message.replace(/\s+/g, " ").trim();
  return message(`${a.circleName}: ${a.title}`, a.posterName ? `${a.posterName}: ${text}` : text, `/circles/${a.circleId}`, `announcement-${a.resourceId}`);
}

// a proposal to change a circle: open for an answer, or how it ended
export function proposalPush(d: {
  proposalId: string;
  kind: ProposalKind;
  notice: ProposalNoticeKind;
  circleName: string;
  subjectCircleName?: string;
  changes: ProposalChanges;
  lines: ProposalLine[];
  closesAt: Date;
  proposerName: string;
  objectorName?: string;
  reason?: string;
}): PushMessage {
  const title = proposalTitle(d);
  const event = isEventProposal(d);
  const url = `/proposals/${d.proposalId}`;
  const tag = `proposal-${d.proposalId}`;
  if (d.notice === "opened") return message(`Proposal: ${title}`, `${d.circleName} · from ${d.proposerName}. Respond by ${fmtDateTime(d.closesAt)}.`, url, tag);
  if (d.notice === "objected") return message(`Objected: ${title}`, `${d.objectorName ?? "A member"}${event ? ", so it won't be held" : ""}: ${d.reason ?? "objected"}`, url, tag);
  return message(`Passed: ${title}`, `No one objected, so ${proposalWords(d).passed}.`, url, tag);
}

// an invitation to join a circle, opened where it's accepted or declined
export function invitationPush(d: { invitationId: string; inviterName?: string; circleName: string; tagline: string }): PushMessage {
  return message(`${d.inviterName ?? "A member"} invited you to ${d.circleName}`, d.tagline || "Open it to accept or decline.", `/invitations/${d.invitationId}`, `invitation-${d.invitationId}`);
}

// a system admin's decision on a member's new photo, opening where they'd act on it
export function photoDecisionPush(d: { memberId: number; approved: boolean; note?: string }): PushMessage {
  return d.approved
    ? message("Your new photo is up", "Your neighbors now see it on your profile.", `/profile/${d.memberId}`, "photo-review")
    : message("Your new photo wasn't approved", d.note || "Your profile keeps the photo it had. You're welcome to send another.", "/profile/edit", "photo-review");
}

// one of a circle's tasks was given to you, opened where it's edited
export function taskAssignedPush(d: { taskId: string; circleId: string; circleName: string; title: string; assignerName?: string; due?: string }): PushMessage {
  return message(`${d.assignerName ?? "A member"} gave you a task`, line(d.title, d.circleName, d.due), `/circles/${d.circleId}/tasks/${d.taskId}`, `task-${d.taskId}`);
}

/* The daily digest's push is only a nudge toward the email, with none of its
   detail: the digest is the place for a day's worth of news. A web app can't
   open the mail app, so a tap opens the events list. Tagged so today's
   replaces yesterday's if it's still showing. */
export function digestPush(): PushMessage {
  return message("Your daily digest is in your inbox", "There's news from your circles. Check your email for the details.", "/events", "digest");
}

// someone wrote to a circle you're a member of: who, and what about; opens it
export function circleMessagePush(d: { messageId: string; circleId: string; circleName: string; senderName: string; subject: string }): PushMessage {
  return message(`${d.senderName} wrote to ${d.circleName}`, d.subject, `/circles/${d.circleId}/inbox/${d.messageId}`, `message-${d.messageId}`);
}

/* A new message in a circle's chat. Tagged, it says so; the text is as much
   as fits, unless it isn't plain text (`scheme` not 0: encrypted), when a
   notification can't carry it and says only that there's one. Tagged by
   circle, so a burst of messages is one notification on the device. */
export function chatPush(d: { circleId: string; circleName: string; authorName: string; body: string; scheme: number; tagged: boolean }): PushMessage {
  const text = d.scheme === 0 ? messageText(d.body).replace(/\s+/g, " ").trim() : "Open Circles to read it.";
  return message(d.tagged ? `${d.authorName} tagged you in ${d.circleName}` : `${d.authorName} in ${d.circleName}`, text, `/circles/${d.circleId}/chat`, `chat-${d.circleId}`);
}
