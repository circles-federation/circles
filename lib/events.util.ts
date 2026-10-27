import { validateAgenda } from "./agenda.util";
import { isPastEvent } from "./format.util";
import { REPEAT_FREQUENCIES, localDay } from "./recurrence.util";
import type { AgendaItem, Event, EventKindKey, NotificationKind, ReminderHours, RepeatFrequency } from "./types";

/* What a person submits to create an event, and the checks on it — shared by
   the event form (instant feedback) and lib/db/events.ts (the authoritative
   check; the client is never trusted). Pure, so it runs identically in both.
   The server derives everything else itself: the id, the organizer (the
   signed-in member), and the starting rsvps/votes. */

export const EVENT_TITLE_MAX = 120;
export const EVENT_LOCATION_MAX = 200;
export const EVENT_DESCRIPTION_MAX = 5000;
export const ROLE_LABEL_MAX = 60;
export const MAX_ROLES = 20;

// a signup slot's definition (no members — signing up is a separate action)
export interface RoleDraft {
  label: string;
  description?: string;
  min: number;
  max?: number;
}

export interface EventDraft {
  title: string;
  kind: EventKindKey;
  // who it's shown to
  circleId: string;
  // the circle hosting it, if not the person themselves — its members vote on
  // it before it goes live (an ordinary event only)
  hostCircleId?: string;
  date: string;
  start: string;
  end: string;
  location: string;
  description: string;
  roles?: RoleDraft[];
  // a meeting's agenda, which it has instead of a description (an ordinary
  // event has none)
  agenda?: AgendaItem[];
  // when to remind the people going, in hours before it (REMINDERS); a day
  // before if it's left out
  reminders?: ReminderHours[];
  // repeat on a weekly or monthly pattern read from `date`, until an optional
  // last date — only when creating, and not a meeting (yet); see
  // lib/recurrence.util.ts
  repeat?: { frequency: RepeatFrequency; until?: string };
}

/* How long before an event the people going may be reminded of it, its
   organizer choosing which on the event form (`events.reminders`, in hours):
   each its own notification kind, so someone can be reminded more than once,
   and its own stamp on the event (`events.reminded_hours`), so each is queued
   once. A day before is where a new event starts. */
export const REMINDERS = [
  { hours: 24, kind: "reminder", label: "1 day before" },
  { hours: 2, kind: "reminder_2h", label: "2 hours before" },
  { hours: 1, kind: "reminder_1h", label: "1 hour before" },
] as const satisfies readonly { hours: ReminderHours; kind: NotificationKind; label: string }[];
export type ReminderKind = (typeof REMINDERS)[number]["kind"];
export const DEFAULT_REMINDERS: ReminderHours[] = [24];
export const REMINDER_KINDS: ReminderKind[] = REMINDERS.map((r) => r.kind);

/* The reminders that can still come before an event starts: those further
   off than `now` is from its start. None once it's under an hour away, so
   the form offers only these. Every one while its date or time isn't set. */
export function availableReminders(e: Pick<Event, "date" | "start">, now: Date = new Date()): ReminderHours[] {
  if (!isDay(e.date) || !isClock(e.start)) return REMINDERS.map((r) => r.hours);
  const ms = eventStartsAt(e).getTime() - now.getTime();
  return REMINDERS.map((r) => r.hours).filter((h) => ms > h * 60 * 60 * 1000);
}

// where a new event's reminders start: a day before, or for one sooner the
// longest still to come, or none under an hour away
export function defaultReminders(available: ReminderHours[]): ReminderHours[] {
  const longest = REMINDERS.map((r) => r.hours).find((h) => available.includes(h));
  return longest === undefined ? [] : [longest];
}

// an event's reminders in a few words, under the form's Reminders row:
// "1 day and 1 hour before", or "None"
export function remindersSummary(hours: ReminderHours[]): string {
  const chosen = REMINDERS.filter((r) => hours.includes(r.hours)).map((r) => r.label.replace(/ before$/, ""));
  const last = chosen.pop();
  if (!last) return "None";
  return `${chosen.length > 0 ? `${chosen.join(", ")} and ${last}` : last} before`;
}

export function isReminder(kind: NotificationKind): kind is ReminderKind {
  return (REMINDER_KINDS as NotificationKind[]).includes(kind);
}

// an event's choice as saved: only the offered ones, each once, longest first
// (null for anything that isn't a list of them, for the server to refuse)
export function normalizeReminders(hours: unknown): ReminderHours[] | null {
  if (!Array.isArray(hours) || !hours.every((h) => REMINDERS.some((r) => r.hours === h))) return null;
  return REMINDERS.map((r) => r.hours).filter((h) => hours.includes(h));
}

// when an event starts, in this machine's timezone (the community's — see TZ)
export function eventStartsAt(e: Pick<Event, "date" | "start">): Date {
  const [y, m, d] = e.date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = e.start.split(":").map(Number) as [number, number];
  return new Date(y, m - 1, d, hh, mm);
}

// when it ends: its end time on its date, or the next day's for one that runs
// past midnight (an end at or before its start)
export function eventEndsAt(e: Pick<Event, "date" | "start" | "end">): Date {
  const [y, m, d] = e.date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = e.end.split(":").map(Number) as [number, number];
  const end = new Date(y, m - 1, d, hh, mm);
  if (end <= eventStartsAt(e)) end.setDate(end.getDate() + 1);
  return end;
}

// over: nothing can be RSVP'd to, voted on or signed up for once it's ended
export function hasEnded(e: Pick<Event, "date" | "start" | "end">, now: Date = new Date()): boolean {
  return now >= eventEndsAt(e);
}

/* The reminders an event is already inside of: it starts after `now`, and
   within that many hours of it. An event created or moved this close is
   stamped with them, since its people have only just heard of it. */
export function remindersWithin(e: Pick<Event, "date" | "start">, now: Date = new Date()): ReminderHours[] {
  const ms = eventStartsAt(e).getTime() - now.getTime();
  return ms > 0 ? REMINDERS.map((r) => r.hours).filter((h) => ms <= h * 60 * 60 * 1000) : [];
}

// which dates of a repeating event an edit or a cancellation applies to: the
// one being looked at, or it and every later one (and the series' own
// template, for the dates still to be added)
export type SeriesScope = "one" | "upcoming";

// the part of an event its host can edit afterward — not its circle, kind,
// organizer, rsvps or votes; `roles` is the slot definitions (empty removes them)
export type EventDetails = Pick<EventDraft, "title" | "date" | "start" | "end" | "location" | "description" | "agenda"> & {
  roles: RoleDraft[];
  reminders: ReminderHours[];
};

// the stable key a slot is stored under: its label, slugged (so re-saving an
// event keeps the people already signed up under an unchanged label)
export function roleKey(label: string, index: number): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `slot-${index}`;
}

export const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(`${s}T00:00:00`).getTime());
export const isClock = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toClock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// how long a new event runs unless it's changed
export const DEFAULT_EVENT_MINUTES = 120;

/* When a new event starts unless it's changed: the next quarter hour after
   `now` (6:00 exactly gives 6:15, since now isn't in the future), and that
   day — tomorrow, once it's past 11:45pm. It ends DEFAULT_EVENT_MINUTES
   later, no later than 11:59pm, since an event is a single day. */
export function defaultEventTimes(now: Date = new Date()): { date: string; start: string; end: string } {
  const quarter = 15 * 60_000;
  const next = new Date((Math.floor(now.getTime() / quarter) + 1) * quarter);
  const start = toClock(next.getHours() * 60 + next.getMinutes());
  return { date: localDay(next), start, end: toClock(Math.min(toMinutes(start) + DEFAULT_EVENT_MINUTES, 23 * 60 + 59)) };
}

/* An online event's link: its location, when that's a web address and
   nothing else (so a place's name that mentions a website stays a place).
   null for anywhere in person. */
export function meetingLink(location: string): string | null {
  const text = location.trim();
  if (/\s/.test(text)) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/* Where the end goes when the start moves, as a calendar app does it: along
   with the start, keeping the event as long as it was (an hour, if it wasn't
   a valid length to begin with). An event is a single day, so it stops at
   11:59pm rather than running into the next. The end as it was while the new
   start isn't a whole time yet (a field mid-edit). */
export function endAfterStartMoves(start: string, end: string, newStart: string): string {
  if (!isClock(newStart)) return end;
  const length = isClock(start) && isClock(end) && toMinutes(end) > toMinutes(start) ? toMinutes(end) - toMinutes(start) : 60;
  return toClock(Math.min(toMinutes(newStart) + length, 23 * 60 + 59));
}

// the first problem with a draft, or null when it's fine
// `creating`: a new event must also start after `now`; an edit needn't, so
// an organizer can still fix an event that's already under way today
export function validateEventDraft(d: EventDraft, { creating = false, now = new Date() }: { creating?: boolean; now?: Date } = {}): string | null {
  const noun = d.kind === "meeting" ? "meeting" : "event";
  if (!d.title.trim()) return `Give the ${noun} a title.`;
  if (d.title.trim().length > EVENT_TITLE_MAX) return `Keep the title under ${EVENT_TITLE_MAX} characters.`;
  if (d.kind !== "ordinary" && d.kind !== "meeting") return "Pick event or meeting.";
  if (!d.circleId) return "Pick a circle.";
  if (!isDay(d.date)) return "Pick a date.";
  // what's over can't be edited (see updateEventDetails), so nothing is
  // created in, or moved into, the past either
  if (isPastEvent(d)) return `Pick today or a later date for the ${noun}.`;
  if (!isClock(d.start) || !isClock(d.end)) return "Pick a start and end time.";
  if (creating && eventStartsAt(d) <= now) return "Pick a start time that hasn't passed yet.";
  if (!d.location.trim()) return "Add a location.";
  if (d.location.trim().length > EVENT_LOCATION_MAX) return `Keep the location under ${EVENT_LOCATION_MAX} characters.`;
  if (d.description.length > EVENT_DESCRIPTION_MAX) return "That description is too long.";
  if (d.kind === "meeting") {
    const problem = validateAgenda(d.agenda ?? []);
    if (problem) return problem;
  } else if (d.agenda && d.agenda.length > 0) return "Only a meeting has an agenda.";
  if (d.hostCircleId && d.kind === "meeting") return "A meeting is proposed by you, not hosted by a circle.";
  if (d.reminders !== undefined && !normalizeReminders(d.reminders)) return "Pick when to remind people going.";
  if (d.repeat) {
    if (d.kind === "meeting") return "A meeting can't repeat yet — propose each one on its own.";
    if (!REPEAT_FREQUENCIES.includes(d.repeat.frequency)) return "Pick how often it repeats.";
    if (d.repeat.until !== undefined && (!isDay(d.repeat.until) || d.repeat.until <= d.date)) return "The last date has to be after the first.";
  }
  const roles = d.roles ?? [];
  if (roles.length > 0 && d.kind === "meeting") return "A meeting can't have signup roles.";
  if (roles.length > MAX_ROLES) return `Keep it to ${MAX_ROLES} roles or fewer.`;
  const keys = new Set<string>();
  for (const [i, r] of roles.entries()) {
    const label = r.label.trim();
    if (!label) return "Give every role a name, or remove it.";
    if (label.length > ROLE_LABEL_MAX) return `"${label.slice(0, 20)}…": keep role names under ${ROLE_LABEL_MAX} characters.`;
    if (!Number.isInteger(r.min) || r.min < 0) return `"${label}": the minimum can't be negative.`;
    if (r.max != null && (!Number.isInteger(r.max) || r.max < Math.max(r.min, 1))) return `"${label}": max can't be less than the minimum.`;
    const key = roleKey(label, i);
    if (keys.has(key)) return `Two roles are both named "${label}".`;
    keys.add(key);
  }
  return null;
}

// whether a member is going to an event: on its RSVP list — which is also where
// a meeting's voters land — or holding one of its slots (a slotted event has no
// plain RSVP list, so signing up for a slot is how you attend it)
// everyone going to an event: its RSVPs (a meeting's voters among them) and
// its slot holders — who's told if it's cancelled (see cancelEvent)
export function attendeeIds(e: Event): number[] {
  return [...new Set([...e.rsvps, ...(e.roles ?? []).flatMap((r) => r.members)])];
}

export function isAttending(e: Event, memberId: number): boolean {
  return e.rsvps.includes(memberId) || (e.roles ?? []).some((r) => r.members.includes(memberId));
}

// an event that's the member's own: one they're going to (`going`, their
// RSVP as this browser has it, may be ahead of the server) or organized,
// for a circle or not. Home's Up next and the Events tab's Mine both list
// these.
export function isMyEvent(e: Event, memberId: number, going = false): boolean {
  return going || isAttending(e, memberId) || e.organizerId === memberId;
}
