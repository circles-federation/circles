import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db, type Tx } from "./client";
import { getCircleById, getCirclesForMember, insertCircle } from "./circles";
import { writeCircleRoles } from "./circle-roles";
import { syncDelegate } from "./memberships";
import { UserFacingError } from "./errors";
import { chatMembersOf, touchChatMessage, tombstone } from "./chat";
import { approveHostedEvent, discardEvent, getEvent } from "./events";
import { discardPost, publishPost } from "./neighborhood-posts";
import { enqueueNeighborhoodNotifications, enqueueProposalNotifications, wallClock } from "./notifications";
import { circleChatMessages, circleMembers, circleProposals, circles, eventRsvps, eventVotes, events, members, proposalNotifications, proposalResponses, roles as eventRoles } from "./schema";
import { groupBy } from "./util";
import {
  OBJECTION_REASON_MAX,
  PROPOSAL_WINDOW_MS,
  changedFields,
  describeChanges,
  describeNewCircle,
  describePostProposal,
  everyoneConsented,
  describeEventProposal,
  hasChanges,
  missingCircleBasics,
  neighborhoodConsentFor,
  newCircleDecider,
  validateChanges,
} from "@/lib/proposals.util";
import { describeChatRemoval } from "@/lib/proposals.util";
import { indexCircles, validateNewCircle, type NewCircleInput } from "@/lib/circles.util";
import { DELEGATE } from "@/lib/circle-roles.util";
import { RESOURCE_KIND_LABEL } from "@/lib/resources.util";
import { majority } from "@/lib/governance.util";
import { localDay } from "@/lib/recurrence.util";
import type { Circle, CircleProposal, ConsentResponse, Event, NeighborhoodPost, ProposalChanges, ProposalResponse } from "@/lib/types";

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
    kind: row.kind,
    circleId: row.circleId,
    ...(row.subjectCircleId !== null ? { subjectCircleId: row.subjectCircleId } : {}),
    ...(row.postId !== null ? { postId: row.postId } : {}),
    proposerId: row.proposerId,
    ...(row.eventId !== null ? { eventId: row.eventId } : {}),
    ...(row.chatMessageId !== null ? { chatMessageId: row.chatMessageId } : {}),
    changes: row.changes,
    lines: row.lines,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    closesAt: row.closesAt.toISOString(),
    ...(row.decidedAt ? { decidedAt: row.decidedAt.toISOString() } : {}),
    ...(row.lapsed ? { lapsed: true } : {}),
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

/* The proposals this member has a say in, or made: their circles', those
   about one of their circles that its neighborhood decides too, and their
   own (a new Circle proposed to a neighborhood they don't live in, say).
   Open ones, and those decided in the last month — AppState's `proposals`. */
export async function getProposalsForMember(memberId: number): Promise<CircleProposal[]> {
  const since = new Date(Date.now() - DECIDED_KEPT_DAYS * 24 * 60 * 60 * 1000);
  const mine = db.select({ id: circleMembers.circleId }).from(circleMembers).where(eq(circleMembers.memberId, memberId));
  const rows = await db
    .select()
    .from(circleProposals)
    .where(
      and(
        or(inArray(circleProposals.circleId, mine), inArray(circleProposals.subjectCircleId, mine), eq(circleProposals.proposerId, memberId)),
        or(eq(circleProposals.status, "open"), gte(circleProposals.decidedAt, since))
      )
    )
    .orderBy(desc(circleProposals.createdAt));
  return withResponses(rows);
}

async function memberIdsOf(tx: Tx, circleId: string): Promise<number[]> {
  return (await tx.select({ id: circleMembers.memberId }).from(circleMembers).where(eq(circleMembers.circleId, circleId))).map((r) => r.id);
}

/* Who decides it: its circle's members, and for a change its neighborhood
   decides (subjectCircleId, while open), the members of the circle it would
   change too, who needn't live there. A new Circle is its neighborhood's
   alone, and its proposer has consented by proposing whether or not they
   live there. */
async function decidersOf(tx: Tx, row: Pick<ProposalRow, "kind" | "circleId" | "subjectCircleId">): Promise<number[]> {
  const ids = await memberIdsOf(tx, row.circleId);
  if (row.kind !== "change" || row.subjectCircleId === null) return ids;
  return [...new Set([...ids, ...(await memberIdsOf(tx, row.subjectCircleId))])];
}

/* Who hears how one ended, by email and push: everyone who decides it, but
   for one a neighborhood decides, only its proposer and the members of the
   circle it's about, since a neighborhood is too big to email about each. */
async function toldOfOutcome(tx: Tx, row: ProposalRow): Promise<number[]> {
  if (row.kind === "new_circle") {
    const [deciding] = await tx.select({ type: circles.type }).from(circles).where(eq(circles.id, row.circleId));
    if (deciding?.type === "neighborhood") return [row.proposerId];
  }
  if (row.kind === "change" && row.subjectCircleId !== null) return [...new Set([row.proposerId, ...(await memberIdsOf(tx, row.subjectCircleId))])];
  return decidersOf(tx, row);
}

/* Make a passed proposal's changes, in the transaction that passes it. What
   was agreed is checked again against the circle as it is now: a role holder
   who has since left is left out (as writeCircleRoles always does), and
   anything that's no longer valid — a parent that's gone, say — is skipped
   rather than failing the whole decision. Its proposer is recorded as the
   page's last editor. */
async function applyProposal(tx: Tx, proposal: ProposalRow): Promise<void> {
  const circle = await getCircleById(proposal.subjectCircleId ?? proposal.circleId);
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
  // by the type it has now, should this same proposal have changed it
  if (roles !== undefined) await writeCircleRoles(tx, circle.id, roles, await memberIdsOf(tx, circle.id), valid.type ?? circle.type);
  // its delegate's place above it follows where it now sits (writeCircleRoles does this itself)
  else if (valid.parentId !== undefined || valid.type !== undefined) await syncDelegate(tx, circle.id);
}

// pass it: make its changes, close it, and tell the circle (but `actorId`, if
// it was their answer that passed it). An event proposal's change is the
// event's approval, whose own email (with the event's details) is what tells
// the group, rather than the proposal's "passed" notice.
async function pass(tx: Tx, proposal: ProposalRow, actorId: number | null): Promise<void> {
  // an event that's begun can't usefully be scheduled now: it lapses instead
  if (proposal.eventId !== null && (await eventHasBegun(tx, proposal.eventId))) {
    await lapse(tx, proposal);
    return;
  }
  await tx.update(circleProposals).set({ status: "passed", decidedAt: new Date() }).where(eq(circleProposals.id, proposal.id));
  if (proposal.kind === "event") {
    if (proposal.eventId !== null) await approveHostedEvent(tx, proposal.eventId, actorId);
    return;
  }
  const tell = await toldOfOutcome(tx, proposal);
  if (proposal.kind === "post") {
    if (proposal.postId !== null) await publishPost(tx, proposal.postId);
  } else if (proposal.kind === "new_circle") {
    await startCircle(tx, proposal);
  } else if (proposal.kind === "remove_message") {
    // gone for everyone, as if its author had deleted it (a message since
    // deleted by them is already so)
    if (proposal.chatMessageId !== null) {
      const [msg] = await tx.select({ deletedAt: circleChatMessages.deletedAt }).from(circleChatMessages).where(eq(circleChatMessages.id, proposal.chatMessageId));
      if (msg && !msg.deletedAt) await tombstone(tx, proposal.chatMessageId);
    }
  } else {
    await applyProposal(tx, proposal);
  }
  await enqueueProposalNotifications(tx, proposal.id, "passed", tell.filter((m) => m !== actorId));
}

/* A new Circle its neighborhood consented to: made now, by its proposer, who
   becomes its first member, and recorded on the proposal (subjectCircleId)
   so its page can lead there. Checked again first, against the circles as
   they are now; one that no longer fits (its neighborhood's gone) isn't made. */
async function startCircle(tx: Tx, proposal: ProposalRow): Promise<void> {
  const c = proposal.changes;
  if (!c.type || !c.name || !c.parentId) return;
  const input: NewCircleInput = { type: c.type, name: c.name, tagline: c.tagline ?? "", parentId: c.parentId, domain: c.domain ?? "", aims: c.aims ?? [], ...(c.delegateId !== undefined ? { delegateId: c.delegateId } : {}) };
  // still as it can be: its delegate, say, still a member of the circle it's in
  if (validateNewCircle(input, await getCirclesForMember(proposal.proposerId))) return;
  // one started inside a circle starts with its delegate, who needn't be its
  // proposer; any other with whoever proposed it
  const id = await insertCircle(tx, c.delegateId ?? proposal.proposerId, input);
  if (c.delegateId !== undefined) await writeCircleRoles(tx, id, [{ label: DELEGATE, memberId: c.delegateId }], [c.delegateId], input.type);
  await tx.update(circleProposals).set({ subjectCircleId: id }).where(eq(circleProposals.id, proposal.id));
}

// whether an event's start (its community wall-clock date and time) has come
async function eventHasBegun(tx: Tx, eventId: string, now: Date = new Date()): Promise<boolean> {
  const [row] = await tx
    .select({ begun: sql<boolean>`(${events.date} + ${events.start}) <= ${wallClock(now)}::timestamp` })
    .from(events)
    .where(eq(events.id, eventId));
  return !!row?.begun;
}

/* Withdraw an event proposal whose event began before its circle decided
   it, as its proposer could have: closed as withdrawn (marked as lapsed, so
   its page can say why) and the never-scheduled event discarded. No one is
   told: its page says what happened, and the time has passed anyway. The
   caller holds the proposal's lock. */
async function lapse(tx: Tx, proposal: ProposalRow): Promise<void> {
  await tx.update(circleProposals).set({ status: "withdrawn", lapsed: true, decidedAt: new Date() }).where(eq(circleProposals.id, proposal.id));
  if (proposal.eventId !== null) await discardEvent(tx, proposal.eventId);
}

/* The open event proposals whose event has begun undecided: each lapses
   (lapse, above). Run by the notification poller, before due proposals are
   passed, so one can't be scheduled after its time; pass() checks again for
   an answer that would pass it in between. Bounded by the events' date
   (indexed) before their start time is compared. Returns the ids withdrawn. */
export async function withdrawLapsedEventProposals(now: Date = new Date()): Promise<string[]> {
  const due = await db
    .select({ id: circleProposals.id })
    .from(circleProposals)
    .innerJoin(events, eq(events.id, circleProposals.eventId))
    .where(and(eq(circleProposals.status, "open"), lte(events.date, localDay(now)), sql`(${events.date} + ${events.start}) <= ${wallClock(now)}::timestamp`));
  const withdrawn: string[] = [];
  for (const { id } of due) {
    const did = await db.transaction(async (tx) => {
      const [row] = await tx.select().from(circleProposals).where(eq(circleProposals.id, id)).for("update", { skipLocked: true });
      if (!row || row.status !== "open" || row.eventId === null) return false;
      await lapse(tx, row);
      return true;
    });
    if (did) withdrawn.push(id);
  }
  return withdrawn;
}

/* Consenting to a meeting or a circle-hosted event is also saying you'll be
   there: each consent is an RSVP too, the proposer's included, so whoever's
   going is known by the time it's scheduled. Silence counts as consent but
   not as an RSVP, so a member who never answers isn't marked going. Not for
   an event with signup roles, where people take a role instead (setRsvp
   refuses an RSVP there too). */
async function rsvpConsenters(tx: Tx, eventId: string, memberIds: number[]): Promise<void> {
  if (memberIds.length === 0) return;
  const [slot] = await tx.select({ id: eventRoles.id }).from(eventRoles).where(eq(eventRoles.eventId, eventId)).limit(1);
  if (slot) return;
  await tx.insert(eventRsvps).values(memberIds.map((memberId) => ({ eventId, memberId }))).onConflictDoNothing();
}

/* Propose holding a meeting, or an event the circle hosts (createEvent in
   lib/db/events.ts), in the transaction that creates it, which hasn't been
   approved. Like any proposal its proposer consents by proposing, the rest of
   the circle is asked, and a circle of one decides it at once. Any number can
   be open at once, alongside a change to the circle. Returns its id. */
export async function openEventProposal(tx: Tx, proposerId: number, event: Event, alsoConsented: number[] = []): Promise<string> {
  // the circle that decides it: its host, or a meeting's own circle
  const circleId = event.hostCircleId ?? (event.kind === "meeting" ? event.circleId : null);
  if (!circleId) throw new ProposalError("Only a meeting, or an event a circle hosts, is proposed to it.");
  const slots = (await tx.select({ label: eventRoles.label }).from(eventRoles).where(eq(eventRoles.eventId, event.id))).map((r) => r.label);
  const id = randomUUID();
  const [row] = await tx
    .insert(circleProposals)
    .values({ id, kind: "event", circleId, proposerId, eventId: event.id, changes: {}, lines: describeEventProposal(event, slots), closesAt: new Date(Date.now() + PROPOSAL_WINDOW_MS) })
    .returning();
  const memberIds = await memberIdsOf(tx, circleId);
  // the proposer, and anyone else who has already said yes (an old vote, when
  // an undecided one moved to consent: scripts/convert-to-consent.ts) — still
  // a member, so still theirs to answer
  const consented = [...new Set([proposerId, ...alsoConsented])].filter((m) => m === proposerId || memberIds.includes(m));
  await tx.insert(proposalResponses).values(consented.map((memberId) => ({ proposalId: id, memberId, response: "like" as const })));
  await rsvpConsenters(tx, event.id, consented);
  const responses = consented.map((memberId) => ({ memberId, response: "like" as const, respondedAt: "" }));
  if (everyoneConsented({ responses }, memberIds)) await pass(tx, row!, proposerId);
  else await enqueueProposalNotifications(tx, id, "opened", memberIds.filter((m) => !consented.includes(m)));
  return id;
}

/* Propose a post to the neighborhood's bulletin (proposeNeighborhoodPost in
   lib/db/neighborhood-posts.ts), in the transaction that saves it
   unpublished: like an event, its proposer consents by proposing, the rest
   of the circle is asked, and a circle of one posts it at once. Returns its id. */
export async function openPostProposal(tx: Tx, proposerId: number, post: NeighborhoodPost, neighborhoodName: string): Promise<string> {
  const id = randomUUID();
  const [row] = await tx
    .insert(circleProposals)
    .values({
      id,
      kind: "post",
      circleId: post.circleId,
      proposerId,
      postId: post.id,
      changes: {},
      lines: describePostProposal(post, neighborhoodName, RESOURCE_KIND_LABEL[post.icon]),
      closesAt: new Date(Date.now() + PROPOSAL_WINDOW_MS),
    })
    .returning();
  await tx.insert(proposalResponses).values({ proposalId: id, memberId: proposerId, response: "like" });
  const memberIds = await memberIdsOf(tx, post.circleId);
  if (everyoneConsented({ responses: [{ memberId: proposerId, response: "like", respondedAt: "" }] }, memberIds)) await pass(tx, row!, proposerId);
  else await enqueueProposalNotifications(tx, id, "opened", memberIds.filter((m) => m !== proposerId));
  return id;
}

// a post taken down while it waited (removeNeighborhoodPost): closed, with no notices
export async function withdrawPostProposal(tx: Tx, postId: string): Promise<void> {
  const [row] = await tx
    .update(circleProposals)
    .set({ status: "withdrawn", decidedAt: new Date() })
    .where(and(eq(circleProposals.postId, postId), eq(circleProposals.status, "open")))
    .returning({ id: circleProposals.id });
  if (row) await dropUnsentNotices(tx, row.id);
}

// a withdrawn proposal's notices not yet sent (its "opened", most likely) go
// with it, so no one is asked to answer what's no longer open
async function dropUnsentNotices(tx: Tx, proposalId: string): Promise<void> {
  await tx.delete(proposalNotifications).where(and(eq(proposalNotifications.proposalId, proposalId), isNull(proposalNotifications.sentAt)));
}

/* Propose removing a message from a circle's chat, which its members decide
   by consent like any change to the circle. Any member may, but not for their
   own message (they can delete it). While it's open the message is collapsed
   for everyone ("under review"); if it passes it's removed, and otherwise
   (an objection, a withdrawal) it's back as it was. The proposer has consented
   by proposing, and a circle of one decides at once. */
export async function proposeChatRemoval(memberId: number, messageId: number): Promise<CircleProposal> {
  const id = randomUUID();
  await db.transaction(async (tx) => {
    const [message] = await tx.select().from(circleChatMessages).where(eq(circleChatMessages.id, messageId)).for("update");
    if (!message) throw new ProposalError("That message doesn't exist.");
    const memberIds = await chatMembersOf(memberId, message.circleId);
    if (message.deletedAt) throw new ProposalError("That message has already been removed.");
    if (message.authorId === memberId) throw new ProposalError("It's your message, so you can delete it yourself.");
    const [open] = await tx.select({ id: circleProposals.id }).from(circleProposals).where(and(eq(circleProposals.chatMessageId, messageId), eq(circleProposals.status, "open")));
    if (open) throw new ProposalError("Its circle is already deciding whether to remove this message.");
    const [circle] = await tx.select({ name: circles.name }).from(circles).where(eq(circles.id, message.circleId));
    const [author] = message.authorId !== null ? await tx.select({ name: members.name }).from(members).where(eq(members.id, message.authorId)) : [];
    const [row] = await tx
      .insert(circleProposals)
      .values({
        id,
        kind: "remove_message",
        circleId: message.circleId,
        proposerId: memberId,
        chatMessageId: messageId,
        changes: {},
        lines: describeChatRemoval(message.body, author?.name ?? "A former member", circle?.name ?? ""),
        closesAt: new Date(Date.now() + PROPOSAL_WINDOW_MS),
      })
      .returning();
    await tx.insert(proposalResponses).values({ proposalId: id, memberId, response: "like" });
    if (everyoneConsented({ responses: [{ memberId, response: "like", respondedAt: "" }] }, memberIds)) {
      await pass(tx, row!, memberId);
      return;
    }
    await touchChatMessage(tx, messageId);
    await enqueueProposalNotifications(tx, id, "opened", memberIds.filter((m) => m !== memberId));
  });
  const [proposal] = await withResponses(await db.select().from(circleProposals).where(eq(circleProposals.id, id)));
  return proposal!;
}

/* Its proposer takes back a change to a circle, or a new Circle, while it's
   open: closed as withdrawn, nothing made, with no notices (an event's or a
   post's is withdrawn by cancelling or taking down what it proposes, which
   any member of its circle may). Returns it as it now stands. */
export async function withdrawProposal(memberId: number, id: string): Promise<CircleProposal> {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(circleProposals).where(eq(circleProposals.id, id)).for("update");
    if (!row || !(await decidersOf(tx, row)).concat(row.proposerId).includes(memberId)) throw new ProposalError("That proposal doesn't exist.");
    if (row.kind !== "change" && row.kind !== "new_circle" && row.kind !== "remove_message") throw new ProposalError(row.kind === "event" ? "Withdraw it by cancelling its event." : "Withdraw it by taking down its post.");
    if (row.proposerId !== memberId) throw new ProposalError("Only whoever proposed it can withdraw it.");
    if (row.status !== "open") throw new ProposalError("This proposal has already been decided.");
    const [updated] = await tx.update(circleProposals).set({ status: "withdrawn", decidedAt: new Date() }).where(eq(circleProposals.id, id)).returning();
    await dropUnsentNotices(tx, id);
    if (row.chatMessageId !== null) await touchChatMessage(tx, row.chatMessageId);
    const [full] = await withResponses([updated!], tx);
    return full!;
  });
}

/* Propose starting a Circle in a neighborhood, which can then post to its
   bulletin, so it's the neighborhood's to consent to (createCircleAction
   comes here instead of creating it, for a Circle whose parent is in one).
   Its residents are asked in their next daily digest; its proposer, who may
   not live there, consents by proposing. A neighborhood whose only resident
   is its proposer decides it at once. Returns it, and the new circle's id if
   it was made then and there. */
export async function proposeNewCircle(memberId: number, input: NewCircleInput): Promise<{ proposal: CircleProposal; circleId: string | null }> {
  const visible = await getCirclesForMember(memberId);
  const problem = validateNewCircle(input, visible);
  if (problem) throw new ProposalError(problem);
  const decider = newCircleDecider(input, indexCircles(visible));
  if (!decider) throw new ProposalError("That circle doesn't need anyone's consent to start.");
  const deciding = decider.circle;
  // a circle's own members propose its circles
  if (decider.by === "parent" && !deciding.members.includes(memberId)) throw new ProposalError(`Only a member of ${deciding.name} can propose a circle inside it.`);
  // only a circle started inside another has a delegate; one in a
  // neighborhood starts with its proposer, whatever the request says
  const delegateId = decider.by === "parent" ? input.delegateId : undefined;
  const delegateName = delegateId !== undefined ? (await memberNames([delegateId])).get(delegateId) : undefined;
  const changes: ProposalChanges = {
    type: input.type,
    name: input.name.trim(),
    tagline: input.tagline.trim(),
    parentId: input.parentId,
    domain: (input.domain ?? "").trim(),
    aims: (input.aims ?? []).map((a) => a.trim()).filter(Boolean),
    ...(delegateId !== undefined ? { delegateId } : {}),
  };
  const id = randomUUID();
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(circleProposals)
      .values({ id, kind: "new_circle", circleId: deciding.id, proposerId: memberId, changes, lines: describeNewCircle(input, deciding.name, delegateName), closesAt: new Date(Date.now() + PROPOSAL_WINDOW_MS) })
      .returning();
    await tx.insert(proposalResponses).values({ proposalId: id, memberId, response: "like" });
    const deciders = await memberIdsOf(tx, deciding.id);
    const others = deciders.filter((m) => m !== memberId);
    if (everyoneConsented({ responses: [{ memberId, response: "like", respondedAt: "" }] }, deciders)) await pass(tx, row!, memberId);
    // a circle's members are asked as they are about any change to it; a
    // neighborhood's residents, too many for that, in their daily digest
    else if (decider.by === "parent") await enqueueProposalNotifications(tx, id, "opened", others);
    else await enqueueNeighborhoodNotifications(tx, { proposalId: id }, others);
  });
  const [proposal] = await withResponses(await db.select().from(circleProposals).where(eq(circleProposals.id, id)));
  return { proposal: proposal!, circleId: proposal!.status === "passed" ? (proposal!.subjectCircleId ?? null) : null };
}

/* Move every upcoming meeting and circle-hosted event that's still waiting
   on a majority vote to consent: each becomes an open consent proposal by its
   organizer, the votes already cast counted as consents, so it's scheduled at
   once if they're everyone, and otherwise asks only those who haven't said
   yes. A meeting that already had its majority stays scheduled. Past ones are
   left as they were; one that already has a proposal is skipped, so this can
   be run again safely. Returns how many it converted, and how many of those
   were scheduled at once. Run once, by scripts/convert-to-consent.ts. */
export async function convertMajorityToConsent(): Promise<{ converted: number; scheduled: number }> {
  const today = localDay(new Date());
  const rows = await db
    .select({ id: events.id, kind: events.kind, circleId: events.circleId, hostCircleId: events.hostCircleId, approvedAt: events.approvedAt, approvedByRole: events.approvedByRole, organizerId: events.organizerId })
    .from(events)
    .where(and(isNull(events.cancelledAt), gte(events.date, today), or(and(isNull(events.approvedAt), sql`${events.hostCircleId} is not null`), eq(events.kind, "meeting"))));
  let converted = 0, scheduled = 0;
  for (const r of rows) {
    const did = await db.transaction(async (tx) => {
      await tx.select({ id: events.id }).from(events).where(eq(events.id, r.id)).for("update");
      const [existing] = await tx.select({ id: circleProposals.id }).from(circleProposals).where(eq(circleProposals.eventId, r.id)).limit(1);
      if (existing) return null;
      const deciding = r.hostCircleId ?? r.circleId;
      const [memberIds, voters] = await Promise.all([
        memberIdsOf(tx, deciding),
        tx.select({ memberId: eventVotes.memberId }).from(eventVotes).where(eq(eventVotes.eventId, r.id)).then((vs) => vs.map((v) => v.memberId)),
      ]);
      if (r.kind === "meeting") {
        // a role-holder's meeting needed no vote, and one with its majority was held
        if (r.approvedByRole !== null || voters.filter((v) => memberIds.includes(v)).length >= majority(memberIds.length)) return null;
        await tx.update(events).set({ approvedAt: null }).where(eq(events.id, r.id));
      }
      const event = await getEvent(r.id, tx);
      if (!event) return null;
      const proposalId = await openEventProposal(tx, r.organizerId, event, voters);
      const [after] = await tx.select({ approvedAt: events.approvedAt }).from(events).where(eq(events.id, r.id));
      return { proposalId, scheduled: !!after?.approvedAt };
    });
    if (did) {
      converted++;
      if (did.scheduled) scheduled++;
    }
  }
  return { converted, scheduled };
}

/* An event's open proposal is withdrawn: its event was cancelled before it was
   decided (cancelEvent, which deletes it). Closed with no notices — whoever
   withdrew it knows, and the rest see it on the proposal. */
export async function withdrawEventProposal(tx: Tx, eventId: string): Promise<string | null> {
  const [row] = await tx
    .update(circleProposals)
    .set({ status: "withdrawn", decidedAt: new Date() })
    .where(and(eq(circleProposals.eventId, eventId), eq(circleProposals.status, "open")))
    .returning({ id: circleProposals.id });
  if (row) await dropUnsentNotices(tx, row.id);
  return row?.id ?? null;
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
  // becoming a Circle in a neighborhood, or a Circle moving into one, is that
  // neighborhood's to consent to as well as the circle's own
  const neighborhood = neighborhoodConsentFor(circle, changes, indexCircles(visible));

  const id = randomUUID();
  const passed = await db.transaction(async (tx) => {
    const [open] = await tx
      .select({ id: circleProposals.id })
      .from(circleProposals)
      .where(and(eq(circleProposals.kind, "change"), eq(circleProposals.status, "open"), sql`coalesce(${circleProposals.subjectCircleId}, ${circleProposals.circleId}) = ${circleId}`));
    if (open) throw new ProposalError(`${circle.name} already has a proposal open. Once it's decided, you can propose this.`);
    const [row] = await tx
      .insert(circleProposals)
      .values({
        id,
        circleId: neighborhood?.id ?? circleId,
        ...(neighborhood ? { subjectCircleId: circleId } : {}),
        proposerId: memberId,
        changes,
        lines,
        closesAt: new Date(Date.now() + PROPOSAL_WINDOW_MS),
      })
      .returning();
    await tx.insert(proposalResponses).values({ proposalId: id, memberId, response: "like" });
    const deciders = await decidersOf(tx, row!);
    if (everyoneConsented({ responses: [{ memberId, response: "like", respondedAt: "" }] }, deciders)) {
      await pass(tx, row!, memberId);
      return true;
    }
    // the circle's own members by email and push, and the rest of a
    // neighborhood that decides it in their next digest
    const own = (await memberIdsOf(tx, circleId)).filter((m) => m !== memberId);
    await enqueueProposalNotifications(tx, id, "opened", own);
    if (neighborhood) await enqueueNeighborhoodNotifications(tx, { proposalId: id }, deciders.filter((m) => m !== memberId && !own.includes(m)));
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
    const memberIds = row ? await decidersOf(tx, row) : [];
    // to anyone with no say in it, it doesn't exist
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
      // an event that won't be held, or a post that won't go up: never
      // scheduled or published, so it simply goes
      if (row.eventId !== null) await discardEvent(tx, row.eventId);
      if (row.postId !== null) await discardPost(tx, row.postId);
      // a message back in the thread, no longer under review
      if (row.chatMessageId !== null) await touchChatMessage(tx, row.chatMessageId);
      await enqueueProposalNotifications(tx, id, "objected", (await toldOfOutcome(tx, row)).filter((m) => m !== memberId));
      return false;
    }
    if (row.eventId !== null) await rsvpConsenters(tx, row.eventId, [memberId]);
    const [full] = await withResponses([row], tx);
    if (full && everyoneConsented(full, memberIds)) {
      await pass(tx, row, memberId);
      return true;
    }
    return false;
  });
  const [proposal] = await withResponses(await db.select().from(circleProposals).where(eq(circleProposals.id, id)));
  return { proposal: proposal!, circle: passed ? await getCircleById(proposal!.subjectCircleId ?? proposal!.circleId) : null };
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
