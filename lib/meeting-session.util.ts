import { eventEndsAt, eventStartsAt } from "./events.util";
import type { Event } from "./types";

// a meeting can still be run this long after it ends, since people do start late
export const MEETING_RUN_GRACE_MS = 24 * 60 * 60 * 1000;

export const MEETING_NOTES_MAX = 20_000;

// the Run meeting button's window: from the start time until a day past the end
export function canRunMeeting(e: Pick<Event, "date" | "start" | "end">, now: Date = new Date()): boolean {
  return now >= eventStartsAt(e) && now.getTime() < eventEndsAt(e).getTime() + MEETING_RUN_GRACE_MS;
}

export type MeetingStep = { kind: "attendance" } | { kind: "topic"; index: number } | { kind: "tasks" } | { kind: "wrapup" };

// attendance, a step per topic, tasks, then the wrap-up
export const lastStep = (topicCount: number): number => topicCount + 2;

export function stepAt(step: number, topicCount: number): MeetingStep | null {
  if (!Number.isInteger(step) || step < 0 || step > lastStep(topicCount)) return null;
  if (step === 0) return { kind: "attendance" };
  if (step <= topicCount) return { kind: "topic", index: step - 1 };
  return step === topicCount + 1 ? { kind: "tasks" } : { kind: "wrapup" };
}

// the circle's Facilitator if they're still a member, otherwise whoever started it
export function defaultFacilitator(holder: number | null, starter: number, memberIds: number[]): number {
  return holder !== null && memberIds.includes(holder) ? holder : starter;
}

export function validateNotes(notes: string): string | null {
  return notes.length > MEETING_NOTES_MAX ? `Notes can be up to ${MEETING_NOTES_MAX.toLocaleString("en-US")} characters.` : null;
}
