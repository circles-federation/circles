import type { CirclesById } from "./circles.util";
import type { Circle, Event, EventKindKey, EventKindMeta, Member } from "./types";

/* Governance rules as pure functions over an event and the circle lookup
   (`byId`, from AppState's live circles — never a static seed array). Two
   things are decided by a circle's members, by consent (lib/db/proposals.ts),
   and lib/db/events.ts enforces who can see and do what on the server:

   - a meeting, held by one circle for its own members — unless someone
     holding a role in the circle schedules it, which needs no consent;
   - an event a circle hosts, which goes live for the circle it's shown to
     once the host circle consents.

   Until it's decided one is `proposed`: in no list, only its proposal and its
   own page. Once it is, it's attended by RSVP like any event. */

/* event kinds. An ordinary event a person hosts is scheduled as soon as it's
   made; a meeting is held by a circle and is decided as above. Any circle but
   the city and a group can hold one. */
export const EVENT_KINDS: Record<EventKindKey, EventKindMeta> = {
  ordinary: { governance: false, label: "Event" },
  meeting:  { governance: true,  label: "Meeting" },
};

export function kindOf(e: Event): EventKindMeta {
  return EVENT_KINDS[e.kind || "ordinary"] || EVENT_KINDS.ordinary;
}
// narrows an Event to its meeting-specific fields where governance logic
// reads several of them together and would benefit from real narrowing
// instead of optional-chaining/guards at each field.
export function isMeeting(e: Event): e is Event & { kind: "meeting" } {
  return e.kind === "meeting";
}
// a meeting one of its circle's role-holders scheduled, with no consent needed
export function isScheduledMeeting(e: Event): boolean {
  return isMeeting(e) && !!e.approvedByRole;
}
// hosted by a circle (proposed or already approved), rather than by a person
export function isCircleHosted(e: Event): e is Event & { hostCircleId: string } {
  return !!e.hostCircleId;
}
// a meeting or circle-hosted event its circle hasn't decided yet
export function isProposal(e: Event): boolean {
  return !!e.proposed;
}
// still waiting on its circle's consent: it's in no list, and its page points
// to its proposal (lib/db/proposals.ts)
export function awaitingConsent(e: Event): boolean {
  return !!e.proposed && !e.cancelled;
}
// whether its circle decides it at all: a meeting, or an event a circle hosts
export function isGoverned(e: Event): boolean {
  return isMeeting(e) || isCircleHosted(e);
}
// a decided meeting or circle-hosted event; a plain event has nothing to decide
export function isApproved(e: Event): boolean {
  return isGoverned(e) && !e.proposed;
}
// a simple majority of a circle's members — what an old meeting needed, which
// the move to consent counted existing votes against (scripts/convert-to-consent.ts)
export function majority(memberCount: number): number {
  return Math.floor(memberCount / 2) + 1;
}
// whether a given member is the organizer of this event, and so may edit it —
// the person who created it (for a circle-hosted event, who proposed it).
export function isEventOrganizer(e: Event, member: Member | null | undefined): boolean {
  return !!member && e.organizerId === member.id;
}
// whether a member may edit or cancel it: its organizer, and for one a circle
// holds (it hosts it, or it's the circle's meeting), any of that circle's
// members — lib/db/events.ts's assertCanManage
export function canManageEvent(e: Event, member: Member | null | undefined, byId: CirclesById): boolean {
  if (!member) return false;
  if (e.organizerId === member.id) return true;
  const circleId = e.hostCircleId ?? (isMeeting(e) ? e.circleId : undefined);
  return !!circleId && !!byId[circleId]?.members.includes(member.id);
}
