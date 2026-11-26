import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db, type Tx } from "./client";
import { setDelegate } from "./circle-roles";
import { insertFederation } from "./circles";
import { UserFacingError } from "./errors";
import { enqueueProposalNotifications, replaceProposalNotifications } from "./notifications";
import { circleMembers, circleProposals, circles, proposalDeciders, proposalNominees, proposalResponses } from "./schema";
import { groupBy } from "./util";
import { NOMINEE_REASON_MAX, NOMINEE_WINDOW_MS, federationRefusal, federationStep, type FederationState } from "@/lib/federation.util";
import { PROPOSAL_WINDOW_MS } from "@/lib/proposals.util";
import type { DeciderStage, ProposalDecider, ProposalNominee } from "@/lib/types";

export class FederationError extends UserFacingError {}

/* A coordinating-circle proposal (kind "coordinating_circle"), the data side
   of lib/federation.util.ts: which circles decide it, how far each has got,
   the delegate each puts forward, and the federation made when it passes. It
   lives apart from lib/db/proposals.ts, which calls into it, because it holds
   the one proposal that is decided by several circles, in stages. Everything
   here runs in the caller's transaction, with the proposal's row locked. */

type ProposalRow = typeof circleProposals.$inferSelect;
type DeciderRow = typeof proposalDeciders.$inferSelect;
type NomineeRow = typeof proposalNominees.$inferSelect;

export type FederationOutcome = "waiting" | "passed" | "lapsed";

const iso = (d: Date | null) => (d ? d.toISOString() : undefined);

function toNominee(r: NomineeRow): ProposalNominee {
  return {
    id: r.id,
    memberId: r.memberId,
    nominatedBy: r.nominatedBy,
    status: r.status,
    ...(r.objectedBy !== null ? { objectedBy: r.objectedBy } : {}),
    ...(r.objectionReason ? { objectionReason: r.objectionReason } : {}),
    createdAt: r.createdAt.toISOString(),
  };
}

// each proposal's deciding circles in stage order, with who they've put forward
export async function decidersByProposal(tx: Tx | typeof db, proposalIds: string[]): Promise<Map<string, ProposalDecider[]>> {
  if (proposalIds.length === 0) return new Map();
  const [rows, nominees] = await Promise.all([
    tx.select().from(proposalDeciders).where(inArray(proposalDeciders.proposalId, proposalIds)).orderBy(asc(proposalDeciders.stage), asc(proposalDeciders.circleId)),
    tx.select().from(proposalNominees).where(inArray(proposalNominees.proposalId, proposalIds)).orderBy(asc(proposalNominees.id)),
  ]);
  const byCircle = groupBy(nominees, (n) => `${n.proposalId}/${n.circleId}`, toNominee);
  return groupBy(
    rows,
    (r) => r.proposalId,
    (r): ProposalDecider => ({
      circleId: r.circleId,
      stage: r.stage,
      ...(r.releasedAt ? { releasedAt: iso(r.releasedAt)! } : {}),
      ...(r.closesAt ? { closesAt: iso(r.closesAt)! } : {}),
      ...(r.passedAt ? { passedAt: iso(r.passedAt)! } : {}),
      nominees: byCircle.get(`${r.proposalId}/${r.circleId}`) ?? [],
    })
  );
}

/* The members who can see and answer it: those of the circles it has been
   released to. The others' circles aren't told of it until the first has
   consented, so to them it doesn't exist. */
export async function releasedMemberIds(tx: Tx, proposalId: string): Promise<number[]> {
  const rows = await tx
    .selectDistinct({ id: circleMembers.memberId })
    .from(circleMembers)
    .innerJoin(proposalDeciders, eq(proposalDeciders.circleId, circleMembers.circleId))
    .where(and(eq(proposalDeciders.proposalId, proposalId), isNotNull(proposalDeciders.releasedAt)));
  return rows.map((r) => r.id);
}

async function membersOf(tx: Tx, circleIds: string[]): Promise<Map<string, number[]>> {
  if (circleIds.length === 0) return new Map();
  const rows = await tx.select({ circleId: circleMembers.circleId, memberId: circleMembers.memberId }).from(circleMembers).where(inArray(circleMembers.circleId, circleIds));
  return groupBy(rows, (r) => r.circleId, (r) => r.memberId);
}

// whether they're in a circle that has been asked and hasn't yet consented,
// so still has an answer to give
export async function hasPendingCircle(tx: Tx, proposalId: string, memberId: number): Promise<boolean> {
  const [row] = await tx
    .select({ circleId: proposalDeciders.circleId })
    .from(proposalDeciders)
    .innerJoin(circleMembers, eq(circleMembers.circleId, proposalDeciders.circleId))
    .where(and(eq(proposalDeciders.proposalId, proposalId), eq(circleMembers.memberId, memberId), isNotNull(proposalDeciders.releasedAt), isNull(proposalDeciders.passedAt)))
    .limit(1);
  return !!row;
}

/* Tell a circle its delegate has been put forward, or objected to, all but
   whoever did it, if it's still to consent: silence counts as consent to a
   delegate, so they have to have heard of them. Each replaces what they were
   told of the delegate before, so a second nominee is news again. */
async function tellOfDelegate(tx: Tx, proposalId: string, circleId: string, actorId: number, kind: "nominated" | "nominee_objected"): Promise<void> {
  const all = (await membersOf(tx, [circleId])).get(circleId) ?? [];
  await replaceProposalNotifications(tx, proposalId, kind, ["nominated", "nominee_objected"], all, all.filter((m) => m !== actorId));
}

export async function tellOfNominee(tx: Tx, proposalId: string, circleId: string, actorId: number): Promise<void> {
  const [decider] = await tx
    .select({ passedAt: proposalDeciders.passedAt, status: circleProposals.status })
    .from(proposalDeciders)
    .innerJoin(circleProposals, eq(circleProposals.id, proposalDeciders.proposalId))
    .where(and(eq(proposalDeciders.proposalId, proposalId), eq(proposalDeciders.circleId, circleId)));
  if (decider && decider.status === "open" && !decider.passedAt) await tellOfDelegate(tx, proposalId, circleId, actorId, "nominated");
}

/* Record who decides a proposal just made, and its first delegate: the
   proposer's circle is released now, with the proposal's own window, and the
   others wait. */
export async function openFederation(tx: Tx, row: ProposalRow, ownCircleId: string, delegateId: number, joinIds: string[]): Promise<void> {
  await tx.insert(proposalDeciders).values([
    { proposalId: row.id, circleId: ownCircleId, stage: 1 as DeciderStage, releasedAt: row.createdAt, closesAt: row.closesAt },
    ...joinIds.map((circleId) => ({ proposalId: row.id, circleId, stage: 2 as DeciderStage })),
  ]);
  await tx.insert(proposalNominees).values({ proposalId: row.id, circleId: ownCircleId, memberId: delegateId, nominatedBy: row.proposerId });
}

/* Whether it can still go ahead, or why not: checked when the others are
   released and again when it would pass, since the circles may have changed
   in the days between (archived, moved into a federation by another proposal,
   a delegate who has left). Locks the circles it names, in id order so two of
   these can't wait on each other. */
export async function federationProblem(tx: Tx, row: ProposalRow, withDelegates: boolean): Promise<string | null> {
  const deciders = await tx.select().from(proposalDeciders).where(eq(proposalDeciders.proposalId, row.id));
  const parentId = row.changes.parentId;
  const ids = [...deciders.map((d) => d.circleId), ...(parentId ? [parentId] : [])];
  const locked = await tx.select().from(circles).where(inArray(circles.id, ids)).orderBy(asc(circles.id)).for("update");
  const place = new Map(locked.map((c) => [c.id, c]));
  const grandparents = locked.flatMap((c) => (c.parentId && !place.has(c.parentId) ? [c.parentId] : []));
  const above = grandparents.length > 0 ? await tx.select().from(circles).where(inArray(circles.id, grandparents)) : [];
  const byId = Object.fromEntries([...locked, ...above].map((c) => [c.id, { type: c.type, parentId: c.parentId }]));

  for (const d of deciders) {
    const c = place.get(d.circleId);
    if (!c || c.archivedAt) return "One of the circles is no longer there.";
    const refusal = federationRefusal(c, byId);
    if (refusal) return `${c.name}: ${refusal.toLowerCase()}.`;
  }
  const parent = parentId ? place.get(parentId) : undefined;
  if (!parent || parent.archivedAt || (parent.type !== "neighborhood" && parent.parentId !== null)) return "Where the federation would sit is no longer available.";

  if (withDelegates) {
    const [nominees, members] = await Promise.all([
      tx.select().from(proposalNominees).where(and(eq(proposalNominees.proposalId, row.id), eq(proposalNominees.status, "chosen"))),
      membersOf(tx, deciders.map((d) => d.circleId)),
    ]);
    for (const d of deciders) {
      const nominee = nominees.find((n) => n.circleId === d.circleId);
      if (!nominee || !(members.get(d.circleId) ?? []).includes(nominee.memberId)) return `${place.get(d.circleId)!.name} has no delegate to send.`;
    }
  }
  return null;
}

async function loadState(tx: Tx, row: ProposalRow): Promise<FederationState> {
  const [deciders, nominees, responses] = await Promise.all([
    tx.select().from(proposalDeciders).where(eq(proposalDeciders.proposalId, row.id)),
    tx.select().from(proposalNominees).where(and(eq(proposalNominees.proposalId, row.id), eq(proposalNominees.status, "open"))),
    tx.select().from(proposalResponses).where(eq(proposalResponses.proposalId, row.id)),
  ]);
  const members = await membersOf(tx, deciders.map((d) => d.circleId));
  return {
    proposerId: row.proposerId,
    deciders: deciders.map((d) => {
      const nominee = nominees.find((n) => n.circleId === d.circleId);
      return {
        circleId: d.circleId,
        stage: d.stage,
        memberIds: members.get(d.circleId) ?? [],
        passed: d.passedAt !== null,
        ...(nominee ? { nominee: { status: nominee.status, createdAt: nominee.createdAt } } : {}),
      };
    }),
    responses: responses.map((r) => ({ memberId: r.memberId, response: r.response, respondedAt: r.respondedAt })),
  };
}

/* Take it as far as it can go now: pass the circles that have consented,
   release the rest when the first has, and say whether the whole proposal
   passes (every circle has) or can't go on. `atDeadline` is the poller
   finding its window ended, when silence is consent. Releasing tells the
   other circles' members, but those who have already consented (they're in
   the first circle too) and its proposer. */
export async function advanceFederation(tx: Tx, row: ProposalRow, now: Date, atDeadline: boolean): Promise<FederationOutcome> {
  const state = await loadState(tx, row);
  const step = federationStep(state, atDeadline);
  if (step.lapse) return "lapsed";
  if (step.passed.length > 0) {
    await tx.update(proposalDeciders).set({ passedAt: now }).where(and(eq(proposalDeciders.proposalId, row.id), inArray(proposalDeciders.circleId, step.passed)));
    await tx
      .update(proposalNominees)
      .set({ status: "chosen" })
      .where(and(eq(proposalNominees.proposalId, row.id), inArray(proposalNominees.circleId, step.passed), eq(proposalNominees.status, "open")));
  }
  if (step.release) {
    if (await federationProblem(tx, row, false)) return "lapsed";
    const closesAt = new Date(now.getTime() + PROPOSAL_WINDOW_MS);
    await tx.update(proposalDeciders).set({ releasedAt: now, closesAt }).where(and(eq(proposalDeciders.proposalId, row.id), eq(proposalDeciders.stage, 2)));
    await tx.update(circleProposals).set({ closesAt }).where(eq(circleProposals.id, row.id));
    const asked = new Set(state.deciders.filter((d) => d.stage === 2).flatMap((d) => d.memberIds));
    for (const r of state.responses) if (r.response !== "object") asked.delete(r.memberId);
    asked.delete(row.proposerId);
    await enqueueProposalNotifications(tx, row.id, "opened", [...asked]);
    return "waiting";
  }
  if (step.done) return (await federationProblem(tx, row, true)) ? "lapsed" : "passed";
  return "waiting";
}

// lengthen the others' window so a delegate named, or objected to, late in it
// can still be answered
async function giveTimeToAnswer(tx: Tx, row: ProposalRow, now: Date): Promise<void> {
  const floor = new Date(now.getTime() + NOMINEE_WINDOW_MS);
  const closesAt = row.closesAt > floor ? row.closesAt : floor;
  await tx.update(proposalDeciders).set({ closesAt }).where(and(eq(proposalDeciders.proposalId, row.id), eq(proposalDeciders.stage, 2)));
  await tx.update(circleProposals).set({ closesAt }).where(eq(circleProposals.id, row.id));
}

// the released circle `memberId` belongs to, and so may act for
async function releasedCircleOf(tx: Tx, row: ProposalRow, circleId: string, memberId: number): Promise<DeciderRow> {
  const [decider] = await tx.select().from(proposalDeciders).where(and(eq(proposalDeciders.proposalId, row.id), eq(proposalDeciders.circleId, circleId)));
  const members = (await membersOf(tx, [circleId])).get(circleId) ?? [];
  // to anyone not in a circle it has been released to, it doesn't exist
  if (!decider || !decider.releasedAt || !members.includes(memberId)) throw new FederationError("That proposal doesn't exist.");
  if (decider.stage !== 2) throw new FederationError("Its delegate is part of the proposal itself, so say what you think of it there.");
  if (decider.passedAt) throw new FederationError("This circle has already consented.");
  return decider;
}

/* A member of one of the circles being asked puts someone forward as its
   delegate: themselves or another of its members. One at a time: a second
   waits until the first is objected to. */
export async function nominateDelegate(tx: Tx, row: ProposalRow, memberId: number, circleId: string, nomineeId: number, now: Date): Promise<void> {
  await releasedCircleOf(tx, row, circleId, memberId);
  const members = (await membersOf(tx, [circleId])).get(circleId) ?? [];
  if (!members.includes(nomineeId)) throw new FederationError("Its delegate has to be one of its members.");
  const [current] = await tx
    .select({ id: proposalNominees.id })
    .from(proposalNominees)
    .where(and(eq(proposalNominees.proposalId, row.id), eq(proposalNominees.circleId, circleId), inArray(proposalNominees.status, ["open", "chosen"])));
  if (current) throw new FederationError("A delegate has already been put forward. If you disagree, object to them first.");
  await tx.insert(proposalNominees).values({ proposalId: row.id, circleId, memberId: nomineeId, nominatedBy: memberId });
  await giveTimeToAnswer(tx, row, now);
}

/* A member of a circle being asked objects to the delegate put forward, with
   a reason. It drops them and leaves the proposal open for another, rather
   than ending it as an objection to the federation would. */
export async function objectToNominee(tx: Tx, row: ProposalRow, memberId: number, circleId: string, reason: string, now: Date): Promise<void> {
  await releasedCircleOf(tx, row, circleId, memberId);
  const why = reason.trim();
  if (!why) throw new FederationError("Say why you object, so someone else can be put forward.");
  if (why.length > NOMINEE_REASON_MAX) throw new FederationError(`Keep it to ${NOMINEE_REASON_MAX} characters.`);
  const [dropped] = await tx
    .update(proposalNominees)
    .set({ status: "objected", objectedBy: memberId, objectionReason: why })
    .where(and(eq(proposalNominees.proposalId, row.id), eq(proposalNominees.circleId, circleId), eq(proposalNominees.status, "open")))
    .returning({ id: proposalNominees.id });
  if (!dropped) throw new FederationError("No one is waiting on your answer there.");
  await giveTimeToAnswer(tx, row, now);
  await tellOfDelegate(tx, row.id, circleId, memberId, "nominee_objected");
}

/* It passed: make the federation, move every circle into it, and seat each
   one's chosen delegate in it, as writing the Delegate role does. Already
   checked (advanceFederation), in this same transaction. The federation is
   recorded on the proposal, so its page can lead there. */
export async function startFederation(tx: Tx, row: ProposalRow): Promise<string> {
  const { name, tagline, parentId } = row.changes;
  if (!name || !parentId) throw new FederationError("That federation can't be formed.");
  const [deciders, chosen] = await Promise.all([
    tx.select({ circleId: proposalDeciders.circleId }).from(proposalDeciders).where(eq(proposalDeciders.proposalId, row.id)),
    tx.select().from(proposalNominees).where(and(eq(proposalNominees.proposalId, row.id), eq(proposalNominees.status, "chosen"))),
  ]);
  const id = await insertFederation(tx, row.proposerId, { name, tagline: tagline ?? "", parentId });
  await tx
    .update(circles)
    .set({ parentId: id, lastEditedBy: row.proposerId, lastEditedAt: new Date() })
    .where(inArray(circles.id, deciders.map((d) => d.circleId)));
  for (const n of chosen) await setDelegate(tx, n.circleId, n.memberId);
  await tx.update(circleProposals).set({ subjectCircleId: id }).where(eq(circleProposals.id, row.id));
  return id;
}

// whether any of these circles is already part of a proposal still open
export async function circlesInOpenFederation(tx: Tx, circleIds: string[]): Promise<string[]> {
  const rows = await tx
    .select({ circleId: proposalDeciders.circleId })
    .from(proposalDeciders)
    .innerJoin(circleProposals, eq(circleProposals.id, proposalDeciders.proposalId))
    .where(and(inArray(proposalDeciders.circleId, circleIds), eq(circleProposals.status, "open")));
  return rows.map((r) => r.circleId);
}

export const lockCircles = async (tx: Tx, ids: string[]): Promise<void> => {
  await tx.select({ id: circles.id }).from(circles).where(inArray(circles.id, ids)).orderBy(asc(circles.id)).for("update");
};
