import { isCircleMember, type CirclesById } from "./circles.util";
import type { Circle, Event, EventKindKey, EventKindMeta, Member } from "./types";

/* Governance rules as pure functions over an event and the circle lookup
   (`byId`, from AppState's live circles — never a static seed array). Every
   event belongs to one circle; a meeting is confirmed by a majority of that
   circle's own members, and only they may vote or read its agenda. */

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
// an event may be marked members-only. it's invisible to anyone outside its
// circle — not just un-RSVP-able — so this is also read by AppStateProvider's
// visibleEvents filter, the single point that hides a members-only event from
// non-members everywhere at once.
export function isExclusive(e: Event): boolean {
  return !!e.membersOnly;
}
// whether a given member belongs to the event's circle (used to gate RSVP
// and notifications on members-only events).
export function isEventCircleMember(e: Event, member: Member | null | undefined, byId: CirclesById): boolean {
  if (!member) return false;
  return isCircleMember(eventCircle(e, byId), member.id);
}
// whether a given member organizes this event, and so may edit it — its
// organizer if a person organized it, or any member of the circle if the
// circle itself hosts it (circles are managed collectively, same "any member
// can act for the circle" model as CirclePage's own Manage button).
export function isEventOrganizer(e: Event, member: Member | null | undefined, byId: CirclesById): boolean {
  if (!member) return false;
  if (e.organizerId != null) return e.organizerId === member.id;
  return isEventCircleMember(e, member, byId);
}
/* who may vote on a meeting: its hosting circle's own membership. */
export function canVote(e: Event, member: Member, byId: CirclesById): boolean {
  if (!kindOf(e).governance) return false;
  return isEventCircleMember(e, member, byId);
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
/* who may read a meeting's internal details (agenda, attendees): meeting
   business is private to the hosting circle's membership; ordinary events
   are open to everyone. */
export function canReadDetails(e: Event, member: Member, byId: CirclesById): boolean {
  if (!kindOf(e).governance) return true;
  return isEventCircleMember(e, member, byId);
}
