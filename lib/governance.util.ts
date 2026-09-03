import { MEMBERS, EVENT_KINDS, orgById } from "./data";
import { orgDisplayName, orgMembers } from "./orgs.util";
import type { Event, EventKindMeta, Member, Org } from "./types";

// federation-wide, a council confirms once a majority of neighborhoods endorse
// it (each neighborhood endorses by passing a meeting vote).
export function neighborhoodMajority(): number {
  const total = new Set(MEMBERS.map((m) => m.neighborhood)).size;
  return Math.floor(total / 2) + 1;
}
export function kindOf(e: Event): EventKindMeta {
  return EVENT_KINDS[e.kind || "ordinary"] || EVENT_KINDS.ordinary;
}
export function voteCount(e: Event): number {
  return (e.votes || []).length;
}
// endorsements: neighborhoods that have endorsed a federation council
export function endorsementCount(e: Event): number {
  return (e.endorsements || []).length;
}
export function councilConfirmed(e: Event): boolean {
  return e.kind === "council" && endorsementCount(e) >= neighborhoodMajority();
}
// a meeting's host org — any circle the proposer belongs to (a Neighborhood
// Council, one of its sub-orgs, or another org they're a member of; see
// lib/orgs.util.ts's orgsForMember and new-event-form.page.jsx's "Propose
// for" picker), not just a Neighborhood Council.
function meetingOrg(e: Event): Org | undefined {
  return e.orgId ? orgById(e.orgId) : undefined;
}
// a meeting confirms by a simple majority of its hosting circle's own
// membership (derived, for a Neighborhood Council; literal, otherwise),
// unlike councilConfirmed's neighborhood-endorsement math above. The exact
// percentage is still TBD ("we should use a fixed percentage of the total
// membership" — placeholder for now, applied uniformly to any circle);
// isolated here so it's a one-line change once that's decided.
export function meetingThreshold(e: Event): number {
  const org = meetingOrg(e);
  if (!org) return Infinity;
  return Math.floor(orgMembers(org, MEMBERS).length / 2) + 1;
}
// a governance event is confirmed when its bar is met: meetings by a
// majority of the hosting circle's membership, councils by a majority of
// neighborhoods endorsing.
export function isConfirmed(e: Event): boolean {
  if (e.kind === "council") return councilConfirmed(e);
  if (e.kind === "meeting") return voteCount(e) >= meetingThreshold(e);
  return false;
}
// an event may be marked members-only by its host org (membersOnly). it's
// invisible to anyone outside that org — not just un-RSVP-able — so this is
// also read by AppStateProvider's visibleEvents filter, the single point
// that hides a members-only event from non-members everywhere at once.
export function isExclusive(e: Event): boolean {
  return !!e.membersOnly && e.host.type === "org";
}
// whether a given member belongs to the event's host org (used to gate RSVP
// and notifications on members-only events).
export function isHostOrgMember(e: Event, member: Member | null | undefined): boolean {
  if (!member || e.host.type !== "org") return false;
  const org = orgById(e.host.id);
  return !!org && org.members.includes(member.id);
}
// whether a given member organizes this event, and so may edit it — the
// event's own host for a member-hosted event, or any member of its hosting
// org for an org-hosted one (orgs are managed collectively, same "any
// member can act for the org" model as OrgPage's own Manage button).
export function isEventOrganizer(e: Event, member: Member | null | undefined): boolean {
  if (!member) return false;
  if (e.host.type === "member") return e.host.id === member.id;
  return isHostOrgMember(e, member);
}
// narrows an Event to its meeting-specific fields where governance logic
// reads several of them together and would benefit from real narrowing
// instead of optional-chaining/guards at each field.
export function isMeeting(e: Event): e is Event & { kind: "meeting"; orgId: string; votes: number[] } {
  return e.kind === "meeting";
}
export function isCouncil(e: Event): e is Event & { kind: "council"; votes: number[] } {
  return e.kind === "council";
}
/* who may vote on a governance proposal: a meeting is scoped to its hosting
   circle's own membership; councils are federation-wide (any member). */
export function canVote(e: Event, member: Member): boolean {
  const k = kindOf(e);
  if (!k.governance) return false;
  if (e.kind === "meeting") {
    const org = meetingOrg(e);
    return !!org && orgMembers(org, MEMBERS).includes(member.id);
  }
  if (e.scope === "federation") return true;
  return member.neighborhood === e.scope;
}
// the circle's own display name ("The 903", or an org's plain name) —
// pairs with scopeNoun below to read as e.g. "residents of The 903" or
// "members of Finance Council".
export function scopeLabel(e: Event): string {
  if (e.kind === "meeting") {
    const org = meetingOrg(e);
    return org ? orgDisplayName(org) : "";
  }
  return e.scope === "federation" ? "the federation" : e.scope || "";
}
// "residents" reads naturally for a Neighborhood Council, whose membership
// literally is neighborhood residency; every other circle (a sub-org like
// Finance Council, or an ordinary collective) just has "members" in the
// usual sense. Council-kind events (federation council meetings) are
// always neighborhood/residency-scoped, so they stay "residents".
export function scopeNoun(e: Event): string {
  if (e.kind === "meeting") {
    const org = meetingOrg(e);
    return org && org.neighborhood ? "residents" : "members";
  }
  return "residents";
}
/* who may read a governance event's internal details (agenda, attendees):
   meeting business is private to the hosting circle's membership; councils
   & ordinary events are open to everyone. */
export function canReadDetails(e: Event, member: Member): boolean {
  const k = kindOf(e);
  if (!k.governance) return true;
  if (e.kind === "meeting") {
    const org = meetingOrg(e);
    return !!org && orgMembers(org, MEMBERS).includes(member.id);
  }
  if (e.scope === "federation") return true;
  return member.neighborhood === e.scope;
}
