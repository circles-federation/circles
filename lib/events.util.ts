import { validateAgenda } from "./agenda.util";
import { REPEAT_FREQUENCIES } from "./recurrence.util";
import type { AgendaItem, Event, EventKindKey, RepeatFrequency } from "./types";

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
  // repeat on a weekly or monthly pattern read from `date`, until an optional
  // last date — only when creating, and not a meeting (yet); see
  // lib/recurrence.util.ts
  repeat?: { frequency: RepeatFrequency; until?: string };
}

// which dates of a repeating event an edit or a cancellation applies to: the
// one being looked at, or it and every later one (and the series' own
// template, for the dates still to be added)
export type SeriesScope = "one" | "upcoming";

// the part of an event its host can edit afterward — not its circle, kind,
// organizer, rsvps or votes; `roles` is the slot definitions (empty removes them)
export type EventDetails = Pick<EventDraft, "title" | "date" | "start" | "end" | "location" | "description" | "agenda"> & {
  roles: RoleDraft[];
};

// the stable key a slot is stored under: its label, slugged (so re-saving an
// event keeps the people already signed up under an unchanged label)
export function roleKey(label: string, index: number): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `slot-${index}`;
}

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(`${s}T00:00:00`).getTime());
const isClock = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

// the first problem with a draft, or null when it's fine
export function validateEventDraft(d: EventDraft): string | null {
  const noun = d.kind === "meeting" ? "meeting" : "event";
  if (!d.title.trim()) return `Give the ${noun} a title.`;
  if (d.title.trim().length > EVENT_TITLE_MAX) return `Keep the title under ${EVENT_TITLE_MAX} characters.`;
  if (d.kind !== "ordinary" && d.kind !== "meeting") return "Pick event or meeting.";
  if (!d.circleId) return "Pick a circle.";
  if (!isDay(d.date)) return "Pick a date.";
  if (!isClock(d.start) || !isClock(d.end)) return "Pick a start and end time.";
  if (!d.location.trim()) return "Add a location.";
  if (d.location.trim().length > EVENT_LOCATION_MAX) return `Keep the location under ${EVENT_LOCATION_MAX} characters.`;
  if (d.description.length > EVENT_DESCRIPTION_MAX) return "That description is too long.";
  if (d.kind === "meeting") {
    const problem = validateAgenda(d.agenda ?? []);
    if (problem) return problem;
  } else if (d.agenda && d.agenda.length > 0) return "Only a meeting has an agenda.";
  if (d.hostCircleId && d.kind === "meeting") return "A meeting is proposed by you, not hosted by a circle.";
  if (d.repeat) {
    if (d.kind === "meeting") return "A meeting can't repeat yet — propose each one on its own.";
    if (!REPEAT_FREQUENCIES.includes(d.repeat.frequency)) return "Pick how often it repeats.";
    if (d.repeat.until !== undefined && (!isDay(d.repeat.until) || d.repeat.until <= d.date)) return "The last date has to be after the first.";
  }
  const roles = d.roles ?? [];
  if (roles.length > 0 && d.kind === "meeting") return "A meeting can't have signup slots.";
  if (roles.length > MAX_ROLES) return `Keep it to ${MAX_ROLES} slots or fewer.`;
  const keys = new Set<string>();
  for (const [i, r] of roles.entries()) {
    const label = r.label.trim();
    if (!label) return "Give every slot a name, or remove it.";
    if (label.length > ROLE_LABEL_MAX) return `"${label.slice(0, 20)}…": keep slot names under ${ROLE_LABEL_MAX} characters.`;
    if (!Number.isInteger(r.min) || r.min < 0) return `"${label}": the minimum can't be negative.`;
    if (r.max != null && (!Number.isInteger(r.max) || r.max < Math.max(r.min, 1))) return `"${label}": max can't be less than the minimum.`;
    const key = roleKey(label, i);
    if (keys.has(key)) return `Two slots are both named "${label}".`;
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
