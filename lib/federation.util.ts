import { CIRCLE_NAME_MAX, CIRCLE_TAGLINE_MAX, indexCircles, isCircleMember, parentCircleOptions, type CirclesById } from "./circles.util";
import type { Circle, CircleProposal, CircleType, ConsentResponse, DeciderStage, NomineeStatus, ProposalDecider, ProposalLine } from "./types";

/* Collectives and co-ops can federate: their members propose a new coordinating
   circle, a Federation, which becomes the parent of all of them. It sits where
   its proposer chooses (a neighborhood or the city), and its members are the
   delegates of the circles inside it, so every circle in one has a Delegate.
   The proposer's circle consents first; the others see the proposal only once
   it has (see circle_proposal_deciders in lib/db/schema.ts). Pure rules,
   shared by the form and lib/db/proposals.ts, the authoritative check. */

export const FEDERATABLE_TYPES: readonly CircleType[] = ["collective", "cooperative"];
export const MIN_FEDERATION_CIRCLES = 2;
export const MAX_FEDERATION_CIRCLES = 20;
// naming or objecting to a delegate gives the circles at least this long to answer
export const NOMINEE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const NOMINEE_REASON_MAX = 1000;

// where a circle is, which is all these rules need to know of it
type Placed = Pick<Circle, "type" | "parentId">;

// the federation this circle sits directly inside, if it does
export function circleFederation<T extends Placed>(circle: Pick<Circle, "parentId">, byId: Record<string, T>): T | null {
  const parent = circle.parentId !== null ? byId[circle.parentId] : undefined;
  return parent?.type === "federation" ? parent : null;
}

export function circleIsInFederation(circle: Pick<Circle, "parentId">, byId: Record<string, Placed>): boolean {
  return circleFederation(circle, byId) !== null;
}

/* Why a circle can't join a federation, in a few words under it in the
   Federation Explorer, or null when it can. Whether another proposal about it
   is open isn't known here; the server checks that under a lock. */
export function federationRefusal(candidate: Placed, byId: Record<string, Placed>): string | null {
  if (candidate.parentId === null) return "The whole city";
  if (!FEDERATABLE_TYPES.includes(candidate.type)) return "Only collectives and co-ops";
  if (circleIsInFederation(candidate, byId)) return "Already in a federation";
  return null;
}

/* Where the federation starts out in the form: the neighborhood the circles
   all share, otherwise the city. The proposer can choose any place a circle
   can be put (parentCircleOptions). */
export function defaultFederationParent(circleIds: string[], byId: CirclesById): Circle | null {
  const parents = new Set(circleIds.map((id) => byId[id]?.parentId));
  const sharedId = parents.size === 1 ? [...parents][0] : null;
  const shared = sharedId ? byId[sharedId] : undefined;
  if (shared && shared.type === "neighborhood") return shared;
  return Object.values(byId).find((c) => c.parentId === null) ?? null;
}

export interface NewFederationInput {
  name: string;
  tagline: string;
  // a neighborhood or the city
  parentId: string;
  // the circle whose member proposes it, which decides first, and the delegate
  // it sends to the federation
  circleId: string;
  delegateId?: number;
  // the other circles, who decide once it has
  joinIds: string[];
}

export type NewFederationField = "name" | "tagline" | "parentId" | "circleIds" | "delegateId";

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/* What's wrong with a proposed federation, and which field it's about, or
   null: the form shows it under that field. */
export function checkNewFederation(input: NewFederationInput, proposerId: number, circles: Circle[]): { field: NewFederationField; message: string } | null {
  const byId = indexCircles(circles);
  const name = input.name.trim();
  if (!name) return { field: "name", message: "Give the federation a name." };
  if (name.length > CIRCLE_NAME_MAX) return { field: "name", message: `Keep the name to ${CIRCLE_NAME_MAX} characters.` };
  if (input.tagline.trim().length > CIRCLE_TAGLINE_MAX) return { field: "tagline", message: `Keep the tagline to ${CIRCLE_TAGLINE_MAX} characters.` };

  const own = byId[input.circleId];
  if (!own || !isCircleMember(own, proposerId)) return { field: "circleIds", message: "Propose it from a circle you're in." };
  const ids = [input.circleId, ...input.joinIds];
  if (new Set(ids).size !== ids.length) return { field: "circleIds", message: "Each circle can join only once." };
  if (ids.length < MIN_FEDERATION_CIRCLES) return { field: "circleIds", message: "Choose at least one other circle to federate with." };
  if (ids.length > MAX_FEDERATION_CIRCLES) return { field: "circleIds", message: `Keep it to ${MAX_FEDERATION_CIRCLES} circles or fewer.` };
  for (const id of ids) {
    const c = byId[id];
    const refusal = c ? federationRefusal(c, byId) : "Not found";
    if (refusal) return { field: "circleIds", message: `${c?.name ?? "A circle"}: ${lower(refusal)}.` };
  }

  if (input.delegateId === undefined) return { field: "delegateId", message: `Choose ${own.name}'s delegate.` };
  if (!isCircleMember(own, input.delegateId)) return { field: "delegateId", message: `Its delegate has to be a member of ${own.name}.` };
  if (!parentCircleOptions(circles).some((c) => c.id === input.parentId)) return { field: "parentId", message: "Choose where the federation sits." };
  return null;
}

export function validateNewFederation(input: NewFederationInput, proposerId: number, circles: Circle[]): string | null {
  return checkNewFederation(input, proposerId, circles)?.message ?? null;
}

// who decides, and when: the proposer's circle in the first stage, the rest in the second
export function federationDeciders(input: Pick<NewFederationInput, "circleId" | "joinIds">): { circleId: string; stage: DeciderStage }[] {
  return [{ circleId: input.circleId, stage: 1 }, ...input.joinIds.map((circleId) => ({ circleId, stage: 2 as const }))];
}

// a federation as its proposal reads to the circles asked to consent to it
export function describeNewFederation(input: Pick<NewFederationInput, "name" | "tagline">, names: { parent: string; circles: string[]; ownCircle: string; delegate: string }): ProposalLine[] {
  return [
    { label: "Name", before: "", after: input.name.trim() },
    { label: "Type", before: "", after: "Federation" },
    ...(input.tagline.trim() ? [{ label: "Tagline", before: "", after: input.tagline.trim() }] : []),
    { label: "Where", before: "", after: names.parent },
    { label: "Circles", before: "", after: names.circles.join("; ") },
    { label: `${names.ownCircle}'s delegate`, before: "", after: names.delegate },
  ];
}

/* How far a coordinating-circle proposal has got, and what happens next.
   Pure, so the rules can be read and tested apart from the database
   (lib/db/federations.ts loads this and applies what it says).

   Stage 1 is the proposer's circle, whose delegate is part of the proposal, so
   consenting to it is consenting to them. It passes once all its members have
   consented, or when its window closes with no objection (an objection would
   have ended the whole proposal). Then the others are released. Each of them
   needs a delegate its members haven't objected to: it passes early once every
   member has consented since the nominee was named (or is the proposer, who
   consented by proposing), and otherwise when the window closes, if it has a
   nominee. A circle with none by then can't take part, so the proposal lapses. */
export interface FederationState {
  proposerId: number;
  deciders: {
    circleId: string;
    stage: DeciderStage;
    memberIds: number[];
    passed: boolean;
    // its current nominee, if open
    nominee?: { status: NomineeStatus; createdAt: Date };
  }[];
  responses: { memberId: number; response: ConsentResponse; respondedAt: Date }[];
}

export interface FederationStep {
  // circles that pass now
  passed: string[];
  // the first stage has passed, so the rest are released
  release: boolean;
  // a circle with no delegate at the deadline: the proposal can't go on
  lapse: string | null;
  // every circle has passed
  done: boolean;
}

export function federationStep(state: FederationState, atDeadline: boolean): FederationStep {
  const consented = (memberId: number, since?: Date) => {
    if (memberId === state.proposerId) return true;
    const r = state.responses.find((x) => x.memberId === memberId);
    return !!r && r.response !== "object" && (!since || r.respondedAt >= since);
  };
  const first = state.deciders.find((d) => d.stage === 1);
  if (first && !first.passed) {
    const ready = atDeadline || first.memberIds.every((m) => consented(m));
    return { passed: ready ? [first.circleId] : [], release: ready, lapse: null, done: false };
  }
  const rest = state.deciders.filter((d) => d.stage === 2 && !d.passed);
  const passed: string[] = [];
  for (const d of rest) {
    if (d.nominee?.status !== "open") {
      if (atDeadline) return { passed: [], release: false, lapse: d.circleId, done: false };
      continue;
    }
    if (atDeadline || d.memberIds.every((m) => consented(m, d.nominee!.createdAt))) passed.push(d.circleId);
  }
  return { passed, release: false, lapse: null, done: rest.every((d) => passed.includes(d.circleId)) };
}

type Rosters = Record<string, Pick<Circle, "members">>;

// the circles a member can still answer for: ones they're in that have been
// asked and haven't consented
export function pendingFederationCircles(p: Pick<CircleProposal, "deciders">, memberId: number, byId: Rosters): ProposalDecider[] {
  return (p.deciders ?? []).filter((d) => d.releasedAt && !d.passedAt && byId[d.circleId]?.members.includes(memberId));
}

// whether a delegate was named after they answered, so their answer doesn't
// yet count as consent to that delegate
export function answerIsStale(p: Pick<CircleProposal, "deciders" | "responses">, memberId: number, byId: Rosters): boolean {
  const mine = p.responses.find((r) => r.memberId === memberId);
  if (!mine) return false;
  return pendingFederationCircles(p, memberId, byId).some((d) => d.stage === 2 && d.nominees.some((n) => n.status === "open" && mine.respondedAt < n.createdAt));
}
