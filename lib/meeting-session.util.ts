import { eventEndsAt, eventStartsAt } from "./events.util";
import type { Event } from "./types";

// a meeting can still be run this long after it ends, since people do start late
export const MEETING_RUN_GRACE_MS = 24 * 60 * 60 * 1000;

export const MEETING_NOTES_MAX = 20_000;

// the Run meeting button's window: from the start time until a day past the end
export function canRunMeeting(e: Pick<Event, "date" | "start" | "end">, now: Date = new Date()): boolean {
  return now >= eventStartsAt(e) && now.getTime() < eventEndsAt(e).getTime() + MEETING_RUN_GRACE_MS;
}

export type MeetingStep = { kind: "attendance" } | { kind: "agenda" } | { kind: "topic"; index: number } | { kind: "tasks" } | { kind: "wrapup" };

// attendance, the agenda's review, a step per topic, tasks, then the wrap-up
export const lastStep = (topicCount: number): number => topicCount + 3;

export function stepAt(step: number, topicCount: number): MeetingStep | null {
  if (!Number.isInteger(step) || step < 0 || step > lastStep(topicCount)) return null;
  if (step === 0) return { kind: "attendance" };
  if (step === 1) return { kind: "agenda" };
  if (step <= topicCount + 1) return { kind: "topic", index: step - 2 };
  return step === topicCount + 2 ? { kind: "tasks" } : { kind: "wrapup" };
}

/* Topics are added and removed while the meeting's going, so where it is has to
   follow what it was on: a topic added puts tasks and the wrap-up a step
   later; one removed takes them a step earlier, and those after it (the one
   on screen included, if it's the one that goes, which moves to what
   followed it). */
export function stepAfterTopicAdded(step: number, topicCount: number): number {
  return step >= topicCount + 2 ? step + 1 : step;
}

export function stepAfterTopicRemoved(step: number, topicCount: number, position: number): number {
  if (step >= topicCount + 2) return step - 1;
  return step >= 2 && position < step - 2 ? step - 1 : step;
}

// the circle's Facilitator if they're still a member, otherwise whoever started it
export function defaultFacilitator(holder: number | null, starter: number, memberIds: number[]): number {
  return holder !== null && memberIds.includes(holder) ? holder : starter;
}

export function validateNotes(notes: string): string | null {
  return notes.length > MEETING_NOTES_MAX ? `Notes can be up to ${MEETING_NOTES_MAX.toLocaleString("en-US")} characters.` : null;
}
