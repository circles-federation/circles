import type { CirclesById } from "./circles.util";
import type { Circle, Event, EventKindKey, EventKindMeta, Member } from "./types";

/* Governance rules as pure functions over an event and the circle lookup
   (`byId`, from AppState's live circles — never a static seed array). Two
   things put an event to a vote, and in both a circle's own members are the
   voters (lib/db/events.ts enforces who can see and vote on the server):

   - a meeting, held by one circle for its own members, is approved by a
     majority of that circle's members — attending and voting are one act;
   - a circle-hosted event starts as a proposal: only the host circle's
     members can see it, and it goes live for the circle it's shown to once a
     majority of the host circle approves it. Approval is latched by the
     server (`proposed` flips to false and stays), unlike a meeting's quorum,
     which is recomputed from the live votes. */

/* event kinds. ordinary events are scheduled instantly by their organizer
   (unless a circle hosts them — see above); a meeting is *proposed* for a
   circle and needs a quorum of that circle's members to be approved — see
   voteThreshold() below. For the prototype, proposing adds it to the list
   right away. Any circle can hold one. */
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
// hosted by a circle (proposed or already approved), rather than by a person
export function isCircleHosted(e: Event): e is Event & { hostCircleId: string } {
  return !!e.hostCircleId;
}
// still awaiting its host circle's approval
export function isProposal(e: Event): boolean {
  return !!e.hostCircleId && !!e.proposed;
}
// whether a vote is what this event is waiting on right now — drives the vote
// banner and the governance-style row. An approved circle-hosted event is
// settled and reads as an ordinary one again.
export function isVoting(e: Event): boolean {
  return isMeeting(e) || isProposal(e);
}
// whether the event has been through (or is in) a vote at all — for filters
export function isGoverned(e: Event): boolean {
  return isMeeting(e) || isCircleHosted(e);
}
export function majority(memberCount: number): number {
  return Math.floor(memberCount / 2) + 1;
}
// the circle whose members vote on this event: a meeting's own circle, or a
// circle-hosted event's host circle
function votingCircle(e: Event, byId: CirclesById): Circle | undefined {
  return byId[isMeeting(e) ? e.circleId : (e.hostCircleId ?? e.circleId)];
}
// a vote passes at a simple majority of the voting circle's own membership —
// shared with lib/db/events.ts, which decides approval on the server.
// The exact percentage is still TBD ("we should use a fixed percentage of the
// total membership" — placeholder for now, applied uniformly to any circle);
// isolated here so it's a one-line change once that's decided.
export function voteThreshold(e: Event, byId: CirclesById): number {
  const circle = votingCircle(e, byId);
  if (!circle) return Infinity;
  return majority(circle.members.length);
}
// a meeting is approved when its votes meet the threshold; a circle-hosted
// event once it has been approved; a plain event has nothing to approve.
export function isApproved(e: Event, byId: CirclesById): boolean {
  if (isMeeting(e)) return voteCount(e) >= voteThreshold(e, byId);
  return isCircleHosted(e) && !e.proposed;
}
// whether a given member is the organizer of this event, and so may edit it —
// the person who created it (for a circle-hosted event, who proposed it).
export function isEventOrganizer(e: Event, member: Member | null | undefined): boolean {
  return !!member && e.organizerId === member.id;
}
// what kind of thing this is, for an eyebrow or badge
export function eventTypeLabel(e: Event): string {
  if (isProposal(e)) return "Proposal";
  return kindOf(e).label;
}
// the name of whoever's vote this is — "The 903", "Finance Council" — pairs
// with votingMemberNoun below to read as e.g. "residents of The 903".
export function votingCircleName(e: Event, byId: CirclesById): string {
  return votingCircle(e, byId)?.name ?? "";
}
// "residents" reads naturally for a neighborhood, whose membership literally
// is residency; every other circle just has "members" in the usual sense.
export function votingMemberNoun(e: Event, byId: CirclesById): string {
  return votingCircle(e, byId)?.type === "neighborhood" ? "residents" : "members";
}
