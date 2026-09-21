import type { CirclesById } from "./circles.util";
import type { Circle, Event, EventKindKey, EventKindMeta, Member } from "./types";

/* Governance rules as pure functions over an event and the circle lookup
   (`byId`, from AppState's live circles — never a static seed array). Every
   event belongs to one circle, which is its audience — only its members can
   see it at all (lib/db/events.ts enforces that on the server), so anyone
   looking at a meeting is one of the members who can vote on it. A meeting is
   confirmed by a majority of that circle's own members. */

/* event kinds. ordinary events are scheduled instantly by anyone; a meeting
   is *proposed* for a circle and needs a quorum of that circle's members to
   be confirmed — see meetingThreshold() below. For the prototype, proposing
   adds it to the list right away. Any circle can hold one. */
export const EVENT_KINDS: Record<EventKindKey, EventKindMeta> = {
  ordinary: { governance: false, label: "Event" },
  meeting:  { governance: true,  label: "Meeting" },
};

export function kindOf(e: Event): EventKindMeta {
  return EVENT_KINDS[e.kind || "ordinary"] || EVENT_KINDS.ordinary;
}
export function voteCount(e: Event): number {
  return (e.votes || []).length;
}
// narrows an Event to its meeting-specific fields where governance logic
// reads several of them together and would benefit from real narrowing
// instead of optional-chaining/guards at each field.
export function isMeeting(e: Event): e is Event & { kind: "meeting"; votes: number[] } {
  return e.kind === "meeting";
}
function eventCircle(e: Event, byId: CirclesById): Circle | undefined {
  return byId[e.circleId];
}
// a meeting confirms by a simple majority of its hosting circle's own
// membership. The exact percentage is still TBD ("we should use a fixed
// percentage of the total membership" — placeholder for now, applied
// uniformly to any circle); isolated here so it's a one-line change once
// that's decided.
export function meetingThreshold(e: Event, byId: CirclesById): number {
  const circle = eventCircle(e, byId);
  if (!circle) return Infinity;
  return Math.floor(circle.members.length / 2) + 1;
}
// a meeting is confirmed when its votes meet the threshold; ordinary events
// have nothing to confirm.
export function isConfirmed(e: Event, byId: CirclesById): boolean {
  if (e.kind !== "meeting") return false;
  return voteCount(e) >= meetingThreshold(e, byId);
}
// whether a given member hosts this event, and so may edit it — the person who
// created it. (Circle-level hosting isn't a thing yet.)
export function isEventOrganizer(e: Event, member: Member | null | undefined): boolean {
  return !!member && e.organizerId === member.id;
}
// the circle's own name ("The 903", "Finance Council") — pairs with
// scopeNoun below to read as e.g. "residents of The 903".
export function scopeLabel(e: Event, byId: CirclesById): string {
  return eventCircle(e, byId)?.name ?? "";
}
// "residents" reads naturally for a neighborhood, whose membership literally
// is residency; every other circle just has "members" in the usual sense.
export function scopeNoun(e: Event, byId: CirclesById): string {
  return eventCircle(e, byId)?.type === "neighborhood" ? "residents" : "members";
}
