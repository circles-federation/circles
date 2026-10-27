import { isBuiltinRole, validateCircleRoles, circleHasRoles } from "./circle-roles.util";
import { CIRCLE_AIM_MAX, CIRCLE_DOMAIN_MAX, CIRCLE_NAME_MAX, CIRCLE_TAGLINE_MAX, CIRCLE_TYPE_LABEL, MAX_CIRCLE_AIMS, circleCanHaveCircles, circleCanHaveInbox, indexCircles, startedInside, circleNeighborhood, parentCircleOptions, type CirclesById, type NewCircleInput } from "./circles.util";
import { AGENDA_CATEGORY } from "./agenda.util";
import { fmtEventWhen } from "./format.util";
import { repeatSummary } from "./recurrence.util";
import { isAnnouncement } from "./resources.util";
import type { Circle, CircleProposal, CircleType, ConsentResponse, Event, NeighborhoodPost, ProposalChanges, ProposalLine, ProposalResponse } from "./types";

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
export const CONSENT_FIELDS = ["name", "tagline", "type", "parentId", "domain", "aims", "roles", "inbox"] as const;

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
  if (draft.inbox !== undefined && draft.inbox !== !!circle.inbox) out.inbox = draft.inbox;
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
  // one started inside a circle stays a Circle there, sending its delegate up
  const inside = startedInside(circle, indexCircles(circles));
  if (inside && changes.type !== undefined && changes.type !== "circle") return problem("type", `A circle inside ${inside.name} stays a Circle, so it can send a delegate.`);
  if (inside && changes.parentId !== undefined && changes.parentId !== circle.parentId) return problem("parentId", `It was started inside ${inside.name}, so it stays there.`);
  if (changes.type !== undefined) {
    const allowed: CircleType[] = ["circle", "collective", "cooperative"];
    if (circle.type === "group" || circle.type === "neighborhood" || !allowed.includes(changes.type)) return problem("type", "That circle can't become that kind of circle.");
  }
  if (changes.parentId !== undefined && !inside) {
    if (circle.parentId === null || !parentCircleOptions(circles, circle.id).some((c) => c.id === changes.parentId)) return problem("parentId", "Choose where this circle sits.");
  }
  if (changes.domain !== undefined && changes.domain.length > CIRCLE_DOMAIN_MAX) return problem("domain", `Keep the domain to ${CIRCLE_DOMAIN_MAX} characters.`);
  if (changes.aims !== undefined) {
    if (changes.aims.length > MAX_CIRCLE_AIMS) return problem("aims", `Keep it to ${MAX_CIRCLE_AIMS} aims or fewer.`);
    if (changes.aims.some((a) => a.length > CIRCLE_AIM_MAX)) return problem("aims", `Keep each aim to ${CIRCLE_AIM_MAX} characters.`);
  }
  // an Inbox only on a Circle, a collective or a co-op, as it is or becomes
  if (changes.inbox && !circleCanHaveInbox({ type: changes.type ?? circle.type, parentId: circle.parentId })) return problem("inbox", "Only a Circle, a collective or a co-op can have an Inbox.");
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
   about what defines it — its type, domain or aims — can't leave it without
   them. Any other proposal (its roles, its name) goes ahead regardless, so a
   Circle that hasn't defined itself yet isn't stopped from deciding anything
   else; Manage circle's Details asks for them all the same (it passes this
   the whole form). Checked when it's proposed (the form, and createProposal),
   not again when it passes, so a change agreed to before doesn't fail on it. */
export function checkCircleBasics(circle: Circle, changes: ProposalChanges): ChangeProblem | null {
  if ((changes.type ?? circle.type) !== "circle") return null;
  if (changes.type === undefined && changes.domain === undefined && changes.aims === undefined) return null;
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
  if (changes.inbox !== undefined) lines.push({ label: "Inbox", before: circle.inbox ? "On" : "Off", after: changes.inbox ? "On" : "Off" });
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

// it proposes an event rather than a change to its circle
export function isEventProposal(p: Pick<CircleProposal, "kind">): boolean {
  return p.kind === "event";
}

/* A post to the neighborhood's bulletin, as its circle reads it before
   consenting: the whole post, and where it'll go. */
const POST_LINE = "Post";
export function describePostProposal(post: Pick<NeighborhoodPost, "title" | "icon" | "url" | "message">, neighborhoodName: string, kindLabel: string): ProposalLine[] {
  return [
    { label: POST_LINE, before: "", after: post.title },
    { label: "Where", before: "", after: `${neighborhoodName}'s bulletin, for everyone who lives there` },
    { label: "Kind", before: "", after: kindLabel },
    ...(isAnnouncement(post.icon) ? [] : [{ label: "Link", before: "", after: post.url ?? "" }]),
    ...(post.message ? [{ label: "Message", before: "", after: post.message }] : []),
  ];
}

// a new Circle, as its neighborhood reads it before consenting
export function describeNewCircle(input: NewCircleInput, whereName: string, delegateName?: string): ProposalLine[] {
  const aims = (input.aims ?? []).map((a) => a.trim()).filter(Boolean);
  return [
    { label: "Name", before: "", after: input.name.trim() },
    { label: "Type", before: "", after: CIRCLE_TYPE_LABEL[input.type] },
    ...(input.tagline.trim() ? [{ label: "Tagline", before: "", after: input.tagline.trim() }] : []),
    { label: "Domain", before: "", after: (input.domain ?? "").trim() },
    { label: "Aims", before: "", after: aims.join("; ") },
    { label: "Where", before: "", after: whereName },
    ...(delegateName ? [{ label: "Delegate", before: "", after: delegateName }] : []),
  ];
}

/* A Circle can post to its neighborhood's bulletin (lib/db/neighborhood-
   posts.ts), so its neighborhood consents to it being one: starting a new
   Circle there, a circle there becoming a Circle, or a Circle moving there
   from somewhere else. The neighborhood that decides, or null if none need
   (it isn't a Circle, or it's citywide). A Circle that leaves a neighborhood
   for the city needs no one else's say. */
export function neighborhoodFor(parentId: string | null, byId: CirclesById): Circle | null {
  const parent = parentId ? byId[parentId] : undefined;
  return parent ? circleNeighborhood(parent, byId) : null;
}

export function neighborhoodConsentFor(circle: Circle, changes: ProposalChanges, byId: CirclesById): Circle | null {
  if ((changes.type ?? circle.type) !== "circle") return null;
  const destination = neighborhoodFor(changes.parentId ?? circle.parentId, byId);
  if (!destination) return null;
  const becomesCircle = circle.type !== "circle";
  const moves = neighborhoodFor(circle.parentId, byId)?.id !== destination.id;
  return becomesCircle || moves ? destination : null;
}

export function newCircleNeighborhood(input: Pick<NewCircleInput, "type" | "parentId">, byId: CirclesById): Circle | null {
  return input.type === "circle" ? neighborhoodFor(input.parentId, byId) : null;
}

/* Whose consent a new circle needs before it starts, if anyone's: one
   inside a circle that can have circles is that circle's to decide (its
   members', and its circles' delegates'), and a Circle in a neighborhood the
   neighborhood's (see newCircleNeighborhood). Anything else is just created. */
export function newCircleDecider(input: Pick<NewCircleInput, "type" | "parentId">, byId: CirclesById): { circle: Circle; by: "parent" | "neighborhood" } | null {
  const inside = byId[input.parentId];
  if (inside && circleCanHaveCircles(inside)) return { circle: inside, by: "parent" };
  const neighborhood = newCircleNeighborhood(input, byId);
  return neighborhood ? { circle: neighborhood, by: "neighborhood" } : null;
}

// a short name for what it proposes: "Rename to Ona Community Garden",
// "Change the name, type and roles", "Schedule Saturday coffee", "Post
// “Survey” to the neighborhood" or "Start the Tenants' Circle"
export function proposalTitle(p: Pick<CircleProposal, "kind" | "changes" | "lines">): string {
  if (isEventProposal(p)) return `Schedule ${p.lines[0]!.after}`;
  if (p.kind === "post") return `Post “${p.lines[0]?.after ?? ""}”`;
  if (p.kind === "new_circle") return `Start ${p.changes.name ?? "a Circle"}`;
  const c = p.changes;
  if (Object.keys(c).length === 1 && c.inbox !== undefined) return c.inbox ? "Turn on the Inbox" : "Turn off the Inbox";
  const parts = [c.name !== undefined && "name", c.tagline !== undefined && "tagline", c.type !== undefined && "type", c.parentId !== undefined && "parent circle", c.domain !== undefined && "domain", c.aims !== undefined && "aims", c.roles !== undefined && "roles", c.inbox !== undefined && "Inbox"].filter(
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

/* A circle's open proposals, its Decisions section and that tab's count:
   what it's deciding itself (a change, its events and posts), and a change
   to it that its neighborhood decides with it, soonest to close first. */
export function openProposalsFor(proposals: CircleProposal[], circleId: string): CircleProposal[] {
  return proposals
    .filter((p) => p.status === "open" && (p.circleId === circleId || p.subjectCircleId === circleId))
    .sort((a, b) => a.closesAt.localeCompare(b.closesAt));
}

// open and still waiting on this member's answer (not its proposer's, who
// consented by proposing it)
export function awaitingResponse(p: CircleProposal, memberId: number): boolean {
  return p.status === "open" && p.proposerId !== memberId && !responseOf(p, memberId);
}
