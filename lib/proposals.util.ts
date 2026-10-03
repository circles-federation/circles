import { BUILTIN_CIRCLE_ROLES, validateCircleRoles, circleHasRoles } from "./circle-roles.util";
import { CIRCLE_NAME_MAX, CIRCLE_TAGLINE_MAX, CIRCLE_TYPE_LABEL, parentCircleOptions } from "./circles.util";
import type { Circle, CircleProposal, CircleType, ConsentResponse, ProposalChanges, ProposalLine, ProposalResponse } from "./types";

/* Consent, as Sociocracy for All describes it: a decision is made unless
   someone has a reasoned objection to it. Some changes to a circle are its
   members' to decide that way — its name, tagline, type, parent and roles —
   so Manage circle proposes them rather than making them (lib/db/proposals.ts).

   A proposal is open for PROPOSAL_WINDOW_MS. Each member answers green (like
   this), yellow (accept this) — both consent — or red (object, with a reason).
   One objection closes it as objected; otherwise it passes when the window
   ends, silence counting as consent, or as soon as every member has
   consented. Its proposer consents by proposing it. */

export const PROPOSAL_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
export const OBJECTION_REASON_MAX = 1000;

export const RESPONSE_LABEL: Record<ConsentResponse, string> = {
  like: "Like this",
  accept: "Accept this",
  object: "Object",
};

// the changes a circle's members decide by consent, as Manage circle edits
// them; anything else on its page is edited freely
export const CONSENT_FIELDS = ["name", "tagline", "type", "parentId", "roles"] as const;

type Roles = NonNullable<ProposalChanges["roles"]>;
const isBuiltinRole = (label: string) => BUILTIN_CIRCLE_ROLES.some((b) => b.toLowerCase() === label.toLowerCase());
const rolesOf = (c: Pick<Circle, "roles">): Roles => (c.roles ?? []).map((r) => ({ label: r.label, memberId: r.memberId }));
const sameRoles = (a: Roles, b: Roles) => JSON.stringify(a) === JSON.stringify(b);

/* Only what actually changes, tidied (names trimmed, a role with no name
   dropped): what a proposal is made of, so an untouched field never needs
   consent. Empty if nothing would change. */
export function changedFields(circle: Circle, draft: ProposalChanges): ProposalChanges {
  const out: ProposalChanges = {};
  if (draft.name !== undefined && draft.name.trim() !== circle.name) out.name = draft.name.trim();
  if (draft.tagline !== undefined && draft.tagline.trim() !== circle.tagline) out.tagline = draft.tagline.trim();
  if (draft.type !== undefined && draft.type !== circle.type) out.type = draft.type;
  if (draft.parentId !== undefined && draft.parentId !== circle.parentId) out.parentId = draft.parentId;
  if (draft.roles !== undefined) {
    const roles = draft.roles.map((r) => ({ label: r.label.trim(), memberId: r.memberId })).filter((r) => r.label !== "");
    if (!sameRoles(roles, rolesOf(circle))) out.roles = roles;
  }
  return out;
}

export const hasChanges = (c: ProposalChanges) => Object.keys(c).length > 0;

/* What's wrong with a proposal's changes to `circle`, or null: the same rules
   Manage circle has always applied, checked by the form as it's filled in and
   by the server when it's proposed and again when it's made. */
export function validateChanges(circle: Circle, changes: ProposalChanges, circles: Circle[]): string | null {
  if (changes.name !== undefined) {
    if (!changes.name) return "Give the circle a name.";
    if (changes.name.length > CIRCLE_NAME_MAX) return `Keep the name to ${CIRCLE_NAME_MAX} characters.`;
  }
  if (changes.tagline !== undefined && changes.tagline.length > CIRCLE_TAGLINE_MAX) return `Keep the tagline to ${CIRCLE_TAGLINE_MAX} characters.`;
  if (changes.type !== undefined) {
    const allowed: CircleType[] = ["circle", "collective", "cooperative"];
    if (circle.type === "group" || circle.type === "neighborhood" || !allowed.includes(changes.type)) return "That circle can't become that kind of circle.";
  }
  if (changes.parentId !== undefined) {
    if (circle.parentId === null || !parentCircleOptions(circles, circle.id).some((c) => c.id === changes.parentId)) return "Choose where this circle sits.";
  }
  if (changes.roles !== undefined) {
    if (!circleHasRoles(circle)) return "This circle doesn't have roles.";
    const problem = validateCircleRoles(changes.roles, circle.members);
    if (problem) return problem;
  }
  return null;
}

/* The proposal's changes as lines to read (label, before, after), worked out
   when it's proposed so it reads the same however things are renamed later.
   `memberName` names a role's holder. */
export function describeChanges(circle: Circle, changes: ProposalChanges, circles: Circle[], memberName: (id: number) => string): ProposalLine[] {
  const lines: ProposalLine[] = [];
  const circleName = (id: string | null) => {
    const c = circles.find((x) => x.id === id);
    return !c ? "" : c.parentId === null ? `${c.name} (the whole city)` : c.name;
  };
  if (changes.name !== undefined) lines.push({ label: "Name", before: circle.name, after: changes.name });
  if (changes.tagline !== undefined) lines.push({ label: "Tagline", before: circle.tagline, after: changes.tagline });
  if (changes.type !== undefined) lines.push({ label: "Type", before: CIRCLE_TYPE_LABEL[circle.type], after: CIRCLE_TYPE_LABEL[changes.type] });
  if (changes.parentId !== undefined) lines.push({ label: "Parent Circle", before: circleName(circle.parentId), after: circleName(changes.parentId) });
  if (changes.roles !== undefined) {
    const holder = (id: number | null) => (id === null ? "Unassigned" : memberName(id));
    const before = rolesOf(circle);
    for (const r of changes.roles) {
      const was = before.find((b) => b.label.toLowerCase() === r.label.toLowerCase());
      if (!was) lines.push({ label: `New role: ${r.label}`, before: "", after: holder(r.memberId) });
      else if (was.memberId !== r.memberId) lines.push({ label: r.label, before: holder(was.memberId), after: holder(r.memberId) });
    }
    // a built-in role left out is only left empty, never removed
    for (const b of before) {
      if (isBuiltinRole(b.label) || changes.roles.some((r) => r.label.toLowerCase() === b.label.toLowerCase())) continue;
      lines.push({ label: `Removed role: ${b.label}`, before: holder(b.memberId), after: "" });
    }
  }
  return lines;
}

// a short name for what it proposes: "Rename to Ona Community Garden", or
// "Change the name, type and roles"
export function proposalTitle(p: Pick<CircleProposal, "changes">): string {
  const c = p.changes;
  const parts = [c.name !== undefined && "name", c.tagline !== undefined && "tagline", c.type !== undefined && "type", c.parentId !== undefined && "parent circle", c.roles !== undefined && "roles"].filter(
    (x): x is string => !!x
  );
  if (parts.length === 1 && c.name !== undefined) return `Rename to ${c.name}`;
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : (parts[0] ?? "details");
  return `Change the ${list}`;
}

export function responseOf(p: Pick<CircleProposal, "responses">, memberId: number): ProposalResponse | undefined {
  return p.responses.find((r) => r.memberId === memberId);
}

// every one of `memberIds` has consented: liked it, or accepts it
export function everyoneConsented(p: Pick<CircleProposal, "responses">, memberIds: number[]): boolean {
  return memberIds.every((id) => {
    const r = responseOf(p, id);
    return r !== undefined && r.response !== "object";
  });
}

// open and still waiting on this member's answer (not its proposer's, who
// consented by proposing it)
export function awaitingResponse(p: CircleProposal, memberId: number): boolean {
  return p.status === "open" && p.proposerId !== memberId && !responseOf(p, memberId);
}
