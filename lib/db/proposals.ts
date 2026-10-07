import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, lte, or } from "drizzle-orm";
import { db, type Tx } from "./client";
import { getCircleById, getCirclesForMember } from "./circles";
import { writeCircleRoles } from "./circle-roles";
import { UserFacingError } from "./errors";
import { enqueueProposalNotifications } from "./notifications";
import { circleMembers, circleProposals, circles, members, proposalResponses } from "./schema";
import { groupBy } from "./util";
import {
  OBJECTION_REASON_MAX,
  PROPOSAL_WINDOW_MS,
  changedFields,
  describeChanges,
  everyoneConsented,
  hasChanges,
  missingCircleBasics,
  validateChanges,
} from "@/lib/proposals.util";
import type { Circle, CircleProposal, ConsentResponse, ProposalChanges, ProposalResponse } from "@/lib/types";

export class ProposalError extends UserFacingError {}

/* Changes to a circle its members decide by consent (see lib/proposals.util.ts
   for the rules). Everything that reads or writes a proposal takes the acting
   member's id and checks they belong to its circle: a proposal, and who said
   what to it, is for that circle's members only. Each write locks the
   proposal's row, so two answers landing at once can't both decide it. */

// decided ones stay in members' app state this long, so the outcome can be read
const DECIDED_KEPT_DAYS = 30;

type ProposalRow = typeof circleProposals.$inferSelect;

function toProposal(row: ProposalRow, responses: ProposalResponse[]): CircleProposal {
  return {
    id: row.id,
    circleId: row.circleId,
    proposerId: row.proposerId,
    changes: row.changes,
    lines: row.lines,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    closesAt: row.closesAt.toISOString(),
    ...(row.decidedAt ? { decidedAt: row.decidedAt.toISOString() } : {}),
    responses,
  };
}

async function withResponses(rows: ProposalRow[], tx: Tx | typeof db = db): Promise<CircleProposal[]> {
  if (rows.length === 0) return [];
  const responseRows = await tx.select().from(proposalResponses).where(inArray(proposalResponses.proposalId, rows.map((r) => r.id)));
  const byProposal = groupBy(responseRows, (r) => r.proposalId, (r): ProposalResponse => ({
    memberId: r.memberId,
    response: r.response,
    ...(r.reason ? { reason: r.reason } : {}),
    respondedAt: r.respondedAt.toISOString(),
  }));
  return rows.map((row) => toProposal(row, byProposal.get(row.id) ?? []));
}

/* The proposals of every circle this member belongs to: open ones, and those
   decided in the last month — AppState's `proposals`. */
export async function getProposalsForMember(memberId: number): Promise<CircleProposal[]> {
  const since = new Date(Date.now() - DECIDED_KEPT_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(circleProposals)
    .where(
      and(
        inArray(circleProposals.circleId, db.select({ id: circleMembers.circleId }).from(circleMembers).where(eq(circleMembers.memberId, memberId))),
        or(eq(circleProposals.status, "open"), gte(circleProposals.decidedAt, since))
      )
    )
    .orderBy(desc(circleProposals.createdAt));
  return withResponses(rows);
}

async function memberIdsOf(tx: Tx, circleId: string): Promise<number[]> {
  return (await tx.select({ id: circleMembers.memberId }).from(circleMembers).where(eq(circleMembers.circleId, circleId))).map((r) => r.id);
}

/* Make a passed proposal's changes, in the transaction that passes it. What
   was agreed is checked again against the circle as it is now: a role holder
   who has since left is left out (as writeCircleRoles always does), and
   anything that's no longer valid — a parent that's gone, say — is skipped
   rather than failing the whole decision. Its proposer is recorded as the
   page's last editor. */
async function applyProposal(tx: Tx, proposal: ProposalRow): Promise<void> {
  const circle = await getCircleById(proposal.circleId);
  if (!circle) return;
  const all = await getCirclesForMember(proposal.proposerId);
  const { roles, ...fields } = proposal.changes;
  const valid = Object.fromEntries(
    Object.entries(fields).filter(([k, v]) => validateChanges(circle, { [k]: v } as ProposalChanges, all) === null)
  ) as Omit<ProposalChanges, "roles">;
  if (Object.keys(valid).length > 0) {
    await tx
      .update(circles)
      .set({ ...valid, lastEditedBy: proposal.proposerId, lastEditedAt: new Date() })
      .where(eq(circles.id, circle.id));
  }
  if (roles !== undefined) await writeCircleRoles(tx, circle.id, roles, await memberIdsOf(tx, circle.id));
}

// pass it: make its changes, close it, and tell the circle (but `actorId`, if
// it was their answer that passed it)
async function pass(tx: Tx, proposal: ProposalRow, actorId: number | null): Promise<void> {
  await applyProposal(tx, proposal);
  await tx.update(circleProposals).set({ status: "passed", decidedAt: new Date() }).where(eq(circleProposals.id, proposal.id));
  const tell = (await memberIdsOf(tx, proposal.circleId)).filter((m) => m !== actorId);
  await enqueueProposalNotifications(tx, proposal.id, "passed", tell);
}

async function memberNames(ids: number[]): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select({ id: members.id, name: members.name }).from(members).where(inArray(members.id, ids));
  return new Map(rows.map((r) => [r.id, r.name]));
}

/* Propose changes to a circle, as `memberId`, one of its members. Only what
   actually changes is proposed, checked by the same rules Manage circle uses.
   The proposer consents by proposing; everyone else is told, and has
   PROPOSAL_WINDOW_MS to answer. A circle of one — or one where everyone has
   somehow already consented — decides it at once. One open proposal per
   circle. Returns it, and the circle as it now is if it passed. */
export async function createProposal(memberId: number, circleId: string, draft: ProposalChanges): Promise<{ proposal: CircleProposal; circle: Circle | null }> {
  const visible = await getCirclesForMember(memberId);
  const circle = visible.find((c) => c.id === circleId);
  if (!circle || !circle.members.includes(memberId)) throw new ProposalError("Only a circle's members can propose changes to it.");
  const changes = changedFields(circle, draft);
  if (!hasChanges(changes)) throw new ProposalError("There's nothing to propose: nothing would change.");
  const problem = validateChanges(circle, changes, visible) ?? missingCircleBasics(circle, changes);
  if (problem) throw new ProposalError(problem);
  const names = await memberNames([...(changes.roles ?? []), ...(circle.roles ?? [])].flatMap((r) => (r.memberId !== null ? [r.memberId] : [])));
  const lines = describeChanges(circle, changes, visible, (id) => names.get(id) ?? "A former member");

  const id = randomUUID();
  const passed = await db.transaction(async (tx) => {
    const [open] = await tx.select({ id: circleProposals.id }).from(circleProposals).where(and(eq(circleProposals.circleId, circleId), eq(circleProposals.status, "open")));
    if (open) throw new ProposalError(`${circle.name} already has a proposal open. Once it's decided, you can propose this.`);
    const [row] = await tx
      .insert(circleProposals)
      .values({ id, circleId, proposerId: memberId, changes, lines, closesAt: new Date(Date.now() + PROPOSAL_WINDOW_MS) })
      .returning();
    await tx.insert(proposalResponses).values({ proposalId: id, memberId, response: "like" });
    const memberIds = await memberIdsOf(tx, circleId);
    if (everyoneConsented({ responses: [{ memberId, response: "like", respondedAt: "" }] }, memberIds)) {
      await pass(tx, row!, memberId);
      return true;
    }
    await enqueueProposalNotifications(tx, id, "opened", memberIds.filter((m) => m !== memberId));
    return false;
  });
  const [proposal] = await withResponses(await db.select().from(circleProposals).where(eq(circleProposals.id, id)));
  return { proposal: proposal!, circle: passed ? await getCircleById(circleId) : null };
}

/* A member's answer to an open proposal: like this, accept this (both
   consent), or an objection with its reason. They can change it while it's open. An
   objection closes it as objected; the answer that leaves every member
   consenting passes it there and then. The proposer has consented by
   proposing, so has nothing to answer. Returns it, and the circle as it now
   is if it passed. */
export async function respondToProposal(
  memberId: number,
  id: string,
  response: ConsentResponse,
  reason?: string
): Promise<{ proposal: CircleProposal; circle: Circle | null }> {
  if (!["like", "accept", "object"].includes(response)) throw new ProposalError("Choose like this, accept this, or object.");
  const why = (reason ?? "").trim();
  if (response === "object" && !why) throw new ProposalError("Say why you object, so the proposal can be changed to meet it.");
  if (why.length > OBJECTION_REASON_MAX) throw new ProposalError(`Keep it to ${OBJECTION_REASON_MAX} characters.`);

  const passed = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(circleProposals).where(eq(circleProposals.id, id)).for("update");
    const memberIds = row ? await memberIdsOf(tx, row.circleId) : [];
    // to anyone outside the circle it doesn't exist
    if (!row || !memberIds.includes(memberId)) throw new ProposalError("That proposal doesn't exist.");
    if (row.status !== "open" || row.closesAt <= new Date()) throw new ProposalError("This proposal has already been decided.");
    if (row.proposerId === memberId) throw new ProposalError("You proposed this, so you've already consented.");
    await tx
      .insert(proposalResponses)
      .values({ proposalId: id, memberId, response, reason: response === "object" ? why : null })
      .onConflictDoUpdate({
        target: [proposalResponses.proposalId, proposalResponses.memberId],
        set: { response, reason: response === "object" ? why : null, respondedAt: new Date() },
      });
    if (response === "object") {
      await tx.update(circleProposals).set({ status: "objected", decidedAt: new Date() }).where(eq(circleProposals.id, id));
      await enqueueProposalNotifications(tx, id, "objected", memberIds.filter((m) => m !== memberId));
      return false;
    }
    const [full] = await withResponses([row], tx);
    if (full && everyoneConsented(full, memberIds)) {
      await pass(tx, row, memberId);
      return true;
    }
    return false;
  });
  const [proposal] = await withResponses(await db.select().from(circleProposals).where(eq(circleProposals.id, id)));
  return { proposal: proposal!, circle: passed ? await getCircleById(proposal!.circleId) : null };
}

/* Pass the open proposals whose window has ended: an objection would already
   have closed one, so reaching its deadline open means no one objected, and
   silence counts as consent. Run by the notification poller (lib/notify.ts);
   each is locked while it's decided, so two servers can't both pass it.
   Returns the ids passed. */
export async function closeDueProposals(now: Date = new Date()): Promise<string[]> {
  const due = await db
    .select({ id: circleProposals.id })
    .from(circleProposals)
    .where(and(eq(circleProposals.status, "open"), lte(circleProposals.closesAt, now)));
  const passed: string[] = [];
  for (const { id } of due) {
    const did = await db.transaction(async (tx) => {
      const [row] = await tx.select().from(circleProposals).where(eq(circleProposals.id, id)).for("update", { skipLocked: true });
      if (!row || row.status !== "open") return false;
      await pass(tx, row, null);
      return true;
    });
    if (did) passed.push(id);
  }
  return passed;
}
