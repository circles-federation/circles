import { isBuiltinRole, validateCircleRoles, circleHasRoles } from "./circle-roles.util";
import { CIRCLE_AIM_MAX, CIRCLE_DOMAIN_MAX, CIRCLE_NAME_MAX, CIRCLE_TAGLINE_MAX, CIRCLE_TYPE_LABEL, MAX_CIRCLE_AIMS, parentCircleOptions } from "./circles.util";
import { AGENDA_CATEGORY } from "./agenda.util";
import { fmtEventWhen } from "./format.util";
import { repeatSummary } from "./recurrence.util";
import type { Circle, CircleProposal, CircleType, ConsentResponse, Event, ProposalChanges, ProposalLine, ProposalResponse } from "./types";

/* Consent, as Sociocracy for All describes it: a decision is made unless
   someone has a reasoned objection to it. Some changes to a circle are its
   members' to decide that way — its name, tagline, type, parent and roles,
   and a Circle's domain and aims —
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
export const CONSENT_FIELDS = ["name", "tagline", "type", "parentId", "domain", "aims", "roles"] as const;

const aimsOf = (c: Pick<Circle, "aims">) => c.aims ?? [];
const sameAims = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify(b);

type Roles = NonNullable<ProposalChanges["roles"]>;
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
  if (draft.domain !== undefined && draft.domain.trim() !== (circle.domain ?? "")) out.domain = draft.domain.trim();
  if (draft.aims !== undefined) {
    const aims = draft.aims.map((a) => a.trim()).filter((a) => a !== "");
    if (!sameAims(aims, aimsOf(circle))) out.aims = aims;
  }
  if (draft.roles !== undefined) {
    const roles = draft.roles.map((r) => ({ label: r.label.trim(), memberId: r.memberId })).filter((r) => r.label !== "");
    if (!sameRoles(roles, rolesOf(circle))) out.roles = roles;
  }
  return out;
}

export const hasChanges = (c: ProposalChanges) => Object.keys(c).length > 0;

// which of the fields a proposal can change a problem is about, so a form can
// show it there
export type ConsentField = (typeof CONSENT_FIELDS)[number];
export interface ChangeProblem {
  field: ConsentField;
  message: string;
}

/* What's wrong with a proposal's changes to `circle`, and which field it's
   about, or null: the same rules Manage circle has always applied, checked by
   the form as it's filled in and by the server when it's proposed and again
   when it's made. validateChanges is the same, as just the message. */
export function checkChanges(circle: Circle, changes: ProposalChanges, circles: Circle[]): ChangeProblem | null {
  const problem = (field: ConsentField, message: string): ChangeProblem => ({ field, message });
  if (changes.name !== undefined) {
    if (!changes.name) return problem("name", "Give the circle a name.");
    if (changes.name.length > CIRCLE_NAME_MAX) return problem("name", `Keep the name to ${CIRCLE_NAME_MAX} characters.`);
  }
  if (changes.tagline !== undefined && changes.tagline.length > CIRCLE_TAGLINE_MAX) return problem("tagline", `Keep the tagline to ${CIRCLE_TAGLINE_MAX} characters.`);
  if (changes.type !== undefined) {
    const allowed: CircleType[] = ["circle", "collective", "cooperative"];
    if (circle.type === "group" || circle.type === "neighborhood" || !allowed.includes(changes.type)) return problem("type", "That circle can't become that kind of circle.");
  }
  if (changes.parentId !== undefined) {
    if (circle.parentId === null || !parentCircleOptions(circles, circle.id).some((c) => c.id === changes.parentId)) return problem("parentId", "Choose where this circle sits.");
  }
  if (changes.domain !== undefined && changes.domain.length > CIRCLE_DOMAIN_MAX) return problem("domain", `Keep the domain to ${CIRCLE_DOMAIN_MAX} characters.`);
  if (changes.aims !== undefined) {
    if (changes.aims.length > MAX_CIRCLE_AIMS) return problem("aims", `Keep it to ${MAX_CIRCLE_AIMS} aims or fewer.`);
    if (changes.aims.some((a) => a.length > CIRCLE_AIM_MAX)) return problem("aims", `Keep each aim to ${CIRCLE_AIM_MAX} characters.`);
  }
  if (changes.roles !== undefined) {
    if (!circleHasRoles(circle)) return problem("roles", "This circle doesn't have roles.");
    const message = validateCircleRoles(changes.roles, circle.members, changes.type ?? circle.type);
    if (message) return problem("roles", message);
  }
  return null;
}

export function validateChanges(circle: Circle, changes: ProposalChanges, circles: Circle[]): string | null {
  return checkChanges(circle, changes, circles)?.message ?? null;
}

/* What a Circle (type "circle") still lacks once a proposal's made, or null:
   sociocracy defines one by its domain and at least one aim, so a proposal
   can't leave a Circle without them — including the first proposal for one
   that has neither yet, for anything. Checked when it's proposed (the form,
   and createProposal), not again when it passes, so a rename agreed to before
   doesn't fail on it. */
export function checkCircleBasics(circle: Circle, changes: ProposalChanges): ChangeProblem | null {
  if ((changes.type ?? circle.type) !== "circle") return null;
  if (!(changes.domain ?? circle.domain ?? "").trim()) return { field: "domain", message: "Give the circle a domain: the area it decides in." };
  if ((changes.aims ?? aimsOf(circle)).length === 0) return { field: "aims", message: "Give the circle at least one aim." };
  return null;
}

export function missingCircleBasics(circle: Circle, changes: ProposalChanges): string | null {
  return checkCircleBasics(circle, changes)?.message ?? null;
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
  if (changes.domain !== undefined) lines.push({ label: "Domain", before: circle.domain ?? "", after: changes.domain });
  if (changes.aims !== undefined) lines.push({ label: "Aims", before: aimsOf(circle).join("; "), after: changes.aims.join("; ") });
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
      if (isBuiltinRole(b.label, circle.type) || changes.roles.some((r) => r.label.toLowerCase() === b.label.toLowerCase())) continue;
      lines.push({ label: `Removed role: ${b.label}`, before: holder(b.memberId), after: "" });
    }
  }
  return lines;
}

/* A group's event, proposed to its members for consent rather than put to a
   majority vote (lib/db/proposals.ts's openEventProposal): its proposal reads
   as the event, with nothing before, since it's new. Worked out when it's
   proposed, like a change's lines, and kept when the event goes, so an
   objected or withdrawn one still says what it was. */
// the first line, its title — also how an event proposal is told apart, since
// no change to a circle has a line called that
const EVENT_LINE = "Title";
export function describeEventProposal(e: Pick<Event, "title" | "kind" | "date" | "start" | "end" | "location" | "description" | "repeat" | "agenda">, slots: string[]): ProposalLine[] {
  // a meeting has its agenda where an event has its details
  const agenda = (e.agenda ?? []).map((a, i) => `${i + 1}. ${AGENDA_CATEGORY[a.category].label}: ${a.title}`).join("\n");
  return [
    { label: EVENT_LINE, before: "", after: e.title },
    ...(e.kind === "meeting" ? [{ label: "Kind", before: "", after: "Meeting" }] : []),
    { label: "When", before: "", after: fmtEventWhen(e) },
    ...(e.repeat ? [{ label: "Repeats", before: "", after: repeatSummary(e.repeat) }] : []),
    { label: "Where", before: "", after: e.location },
    ...(slots.length > 0 ? [{ label: "Roles", before: "", after: slots.join(", ") }] : []),
    ...(agenda ? [{ label: "Agenda", before: "", after: agenda }] : []),
    ...(e.description.trim() ? [{ label: "Details", before: "", after: e.description.trim() }] : []),
  ];
}

// it proposes an event rather than a change to its circle — told by its lines,
// since its event_id goes if the event does
export function isEventProposal(p: Pick<CircleProposal, "changes" | "lines">): boolean {
  return !hasChanges(p.changes) && p.lines[0]?.label === EVENT_LINE;
}

// a short name for what it proposes: "Rename to Ona Community Garden",
// "Change the name, type and roles", or "Schedule Saturday coffee"
export function proposalTitle(p: Pick<CircleProposal, "changes" | "lines">): string {
  if (isEventProposal(p)) return `Schedule ${p.lines[0]!.after}`;
  const c = p.changes;
  const parts = [c.name !== undefined && "name", c.tagline !== undefined && "tagline", c.type !== undefined && "type", c.parentId !== undefined && "parent circle", c.domain !== undefined && "domain", c.aims !== undefined && "aims", c.roles !== undefined && "roles"].filter(
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
