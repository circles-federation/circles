import { MEMBERS, EVENT_KINDS, orgById } from "./data";
import { orgMembers } from "./orgs.util";

// federation-wide, a council confirms once a majority of neighborhoods endorse
// it (each neighborhood endorses by passing a meeting vote).
export function neighborhoodMajority() {
  const total = new Set(MEMBERS.map((m) => m.neighborhood)).size;
  return Math.floor(total / 2) + 1;
}
export function kindOf(e) {
  return EVENT_KINDS[e.kind] || EVENT_KINDS.ordinary;
}
export function voteCount(e) {
  return (e.votes || []).length;
}
// endorsements: neighborhoods that have endorsed a federation council
export function endorsementCount(e) {
  return (e.endorsements || []).length;
}
export function councilConfirmed(e) {
  return e.kind === "council" && endorsementCount(e) >= neighborhoodMajority();
}
// a meeting's host org — its Neighborhood Council (see lib/orgs.util.js)
function meetingOrg(e) {
  return e.orgId ? orgById(e.orgId) : null;
}
// a meeting confirms by a simple majority of its hosting council's own
// (derived) membership, unlike councilConfirmed's neighborhood-endorsement
// math above. The exact percentage is still TBD ("we should use a fixed
// percentage of the total membership" — placeholder for now); isolated here
// so it's a one-line change once that's decided.
export function meetingThreshold(e) {
  const org = meetingOrg(e);
  if (!org) return Infinity;
  return Math.floor(orgMembers(org, MEMBERS).length / 2) + 1;
}
// a governance event is confirmed when its bar is met: meetings by a
// majority of the hosting council's membership, councils by a majority of
// neighborhoods endorsing.
export function isConfirmed(e) {
  if (e.kind === "council") return councilConfirmed(e);
  if (e.kind === "meeting") return voteCount(e) >= meetingThreshold(e);
  return false;
}
// an event may be marked members-only by its host org (membersOnly). it's
// invisible to anyone outside that org — not just un-RSVP-able — so this is
// also read by AppStateProvider's visibleEvents filter, the single point
// that hides a members-only event from non-members everywhere at once.
export function isExclusive(e) {
  return !!e.membersOnly && e.host && e.host.type === "org";
}
// whether a given member belongs to the event's host org (used to gate RSVP
// and notifications on members-only events).
export function isHostOrgMember(e, member) {
  if (!member || !e.host || e.host.type !== "org") return false;
  const org = orgById(e.host.id);
  return !!org && org.members.includes(member.id);
}
/* who may vote on a governance proposal: a meeting is scoped to its hosting
   council's own (derived) membership; councils are federation-wide (any
   member). */
export function canVote(e, member) {
  const k = kindOf(e);
  if (!k.governance) return false;
  if (e.kind === "meeting") {
    const org = meetingOrg(e);
    return !!org && orgMembers(org, MEMBERS).includes(member.id);
  }
  if (e.scope === "federation") return true;
  return member.neighborhood === e.scope;
}
export function scopeLabel(e) {
  if (e.kind === "meeting") {
    const org = meetingOrg(e);
    return org ? org.neighborhood : "";
  }
  return e.scope === "federation" ? "the federation" : e.scope;
}
/* who may read a governance event's internal details (agenda, attendees):
   meeting business is private to the hosting council's membership; councils
   & ordinary events are open to everyone. */
export function canReadDetails(e, member) {
  const k = kindOf(e);
  if (!k.governance) return true;
  if (e.kind === "meeting") {
    const org = meetingOrg(e);
    return !!org && orgMembers(org, MEMBERS).includes(member.id);
  }
  if (e.scope === "federation") return true;
  return member.neighborhood === e.scope;
}
