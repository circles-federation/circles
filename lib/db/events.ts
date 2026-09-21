import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNotNull, isNull, or, sql, type Column, type SQL } from "drizzle-orm";
import { db } from "./client";
import { UserFacingError } from "./errors";
import { circleMembers, circles, eventRsvps, eventVotes, events, roleMembers, roles } from "./schema";
import { groupBy } from "./util";
import { isWithinCircle } from "@/lib/circles.util";
import { roleKey, validateEventDraft, type EventDetails, type EventDraft, type RoleDraft } from "@/lib/events.util";
import { majority } from "@/lib/governance.util";
import type { Event, Role } from "@/lib/types";

/* An event belongs to one circle, and that circle is its audience: only the
   circle's members (and, for the city root, everyone) can see it or RSVP to
   it. An event may instead be hosted by a circle, which need not be the one
   it's shown to: it starts as a proposal that only the host circle's members
   can see and vote on, and goes live for its audience once a majority of
   them approve. This file is where all of that is enforced — not the UI, and
   not the caller. Reads only return events the given member may see; every write
   takes the acting member's id (lib/db/actions.ts passes the signed-in one)
   and checks it, and computes any rsvp/vote/slot arrays itself rather than
   trusting a client-supplied one. Kept free of any session/request access so
   it can be exercised directly. */

export class EventError extends UserFacingError {}

type EventRow = typeof events.$inferSelect;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Postgres always formats a `time` column as "HH:MM:SS" on read, regardless
// of input precision — lib/format.util.ts's fmtTime/eventDateTime assume the
// app's own "HH:MM" shape, so every read normalizes it back to that
function toClockTime(t: string): string {
  return t.slice(0, 5);
}

function toEvent(row: EventRow, rsvps: number[], votes: number[] | undefined, eventRoles: Role[] | undefined): Event {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind ?? undefined,
    circleId: row.circleId,
    ...(row.hostCircleId !== null ? { hostCircleId: row.hostCircleId } : {}),
    ...(row.hostCircleId !== null && row.approvedAt === null ? { proposed: true } : {}),
    organizerId: row.organizerId,
    date: row.date,
    start: toClockTime(row.start),
    end: toClockTime(row.end),
    location: row.location,
    description: row.description,
    rsvps,
    roles: eventRoles,
    votes,
  };
}

async function attachRelations(rows: EventRow[]): Promise<Event[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [rsvpRows, voteRows, roleRows] = await Promise.all([
    db.select().from(eventRsvps).where(inArray(eventRsvps.eventId, ids)),
    db.select().from(eventVotes).where(inArray(eventVotes.eventId, ids)),
    db.select().from(roles).where(inArray(roles.eventId, ids)),
  ]);
  const roleMemberRows = roleRows.length > 0 ? await db.select().from(roleMembers).where(inArray(roleMembers.roleId, roleRows.map((r) => r.id))) : [];
  const rsvpsByEvent = groupBy(rsvpRows, (r) => r.eventId, (r) => r.memberId);
  const votesByEvent = groupBy(voteRows, (r) => r.eventId, (r) => r.memberId);
  const membersByRole = groupBy(roleMemberRows, (r) => r.roleId, (r) => r.memberId);
  const rolesByEvent = new Map<string, Role[]>();
  for (const r of roleRows) {
    const role: Role = {
      key: r.key,
      label: r.label,
      description: r.description ?? undefined,
      min: r.min,
      members: membersByRole.get(r.id) || [],
      ...(r.max != null ? { max: r.max } : {}),
    };
    const list = rolesByEvent.get(r.eventId);
    if (list) list.push(role);
    else rolesByEvent.set(r.eventId, [role]);
  }
  return rows.map((row) =>
    toEvent(
      row,
      rsvpsByEvent.get(row.id) || [],
      // only a meeting or a circle-hosted event carries a votes array
      row.kind === "meeting" || row.hostCircleId !== null ? votesByEvent.get(row.id) || [] : undefined,
      rolesByEvent.get(row.id)
    )
  );
}

// the circles that decide what a member may see: the ones they belong to
// (`own` — a proposal's voters, and what hosting is checked against), and
// those plus the city root (`audience`) — everyone is implicitly in the city,
// see isCircleAudience in lib/circles.util.ts, which this mirrors
interface Viewer {
  own: string[];
  audience: string[];
}
async function viewerCircles(memberId: number): Promise<Viewer> {
  const [memberships, [root]] = await Promise.all([
    db.select({ circleId: circleMembers.circleId }).from(circleMembers).where(eq(circleMembers.memberId, memberId)),
    db.select({ id: circles.id }).from(circles).where(isNull(circles.parentId)),
  ]);
  const own = memberships.map((m) => m.circleId);
  return { own, audience: root ? [...own, root.id] : own };
}

const anyOf = (col: Column, ids: string[]): SQL => (ids.length > 0 ? inArray(col, ids) : sql`false`);

/* Who may see an event: a live one is seen by its circle's audience and by the
   members of the circle hosting it; a proposal (not yet approved) only by the
   host circle's members. getEventsForMember filters on exactly this in SQL and
   canSee applies it to a single row — keep them in step. */
function canSee(row: EventRow, v: Viewer): boolean {
  const hosts = row.hostCircleId !== null && v.own.includes(row.hostCircleId);
  return row.approvedAt === null ? hosts : hosts || v.audience.includes(row.circleId);
}

// every event this member may see — what the app sends to the browser, so an
// event they can't see is never in their page data
export async function getEventsForMember(memberId: number): Promise<Event[]> {
  const v = await viewerCircles(memberId);
  const rows = await db
    .select()
    .from(events)
    .where(
      or(
        and(isNotNull(events.approvedAt), or(anyOf(events.circleId, v.audience), anyOf(events.hostCircleId, v.own))),
        and(isNull(events.approvedAt), anyOf(events.hostCircleId, v.own))
      )
    );
  return attachRelations(rows);
}

async function loadFull(id: string): Promise<Event> {
  const [row] = await db.select().from(events).where(eq(events.id, id));
  const [full] = row ? await attachRelations([row]) : [];
  if (!full) throw new EventError("That event doesn't exist.");
  return full;
}

// an event the member may see — a missing one and one they can't see are
// reported identically, so its existence isn't revealed to an outsider
async function loadVisible(memberId: number, id: string): Promise<EventRow> {
  const [row] = await db.select().from(events).where(eq(events.id, id));
  if (!row || !canSee(row, await viewerCircles(memberId))) throw new EventError("That event doesn't exist.");
  return row;
}

// RSVPs and slot signups open once a circle-hosted event is approved
function assertLive(row: EventRow) {
  if (row.approvedAt === null) throw new EventError("This event is still waiting on its host circle's vote.");
}

async function assertCanPost(v: Viewer, circleId: string): Promise<{ isRoot: boolean }> {
  const [circle] = await db.select({ parentId: circles.parentId }).from(circles).where(eq(circles.id, circleId));
  if (!circle) throw new EventError("That circle doesn't exist.");
  if (!v.audience.includes(circleId)) throw new EventError("You can only post to circles you belong to.");
  return { isRoot: circle.parentId === null };
}

// a circle can host only if it has members of its own to vote (not the city,
// whose roster is implicit), the proposer is one of them, and it's the circle
// the event is shown to or one inside it; returns how many members it has
async function assertCanHost(v: Viewer, circleId: string, audienceCircleId: string): Promise<number> {
  const rows = await db.select({ id: circles.id, parentId: circles.parentId }).from(circles);
  const circle = rows.find((c) => c.id === circleId);
  if (!circle) throw new EventError("That circle doesn't exist.");
  if (circle.parentId === null) throw new EventError("The whole city can't host an event — pick a neighborhood or group.");
  if (!v.own.includes(circleId)) throw new EventError("You can only host on behalf of a circle you belong to.");
  const parents = new Map(rows.map((c) => [c.id, c.parentId]));
  if (!isWithinCircle(circleId, audienceCircleId, (id) => parents.get(id))) {
    throw new EventError("A circle can only host an event shown to itself or to a circle it's part of.");
  }
  const members = await db.select({ id: circleMembers.memberId }).from(circleMembers).where(eq(circleMembers.circleId, circleId));
  return members.length;
}

function buildRoles(drafts: RoleDraft[], existing: Role[] = []): Role[] {
  return drafts.map((r, i) => {
    const key = roleKey(r.label, i);
    const kept = existing.find((e) => e.key === key)?.members ?? [];
    return {
      key,
      label: r.label.trim(),
      description: r.description?.trim() || undefined,
      min: r.min,
      ...(r.max != null ? { max: r.max } : {}),
      // a slot that keeps its name keeps the people already in it
      members: r.max != null ? kept.slice(0, r.max) : kept,
    };
  });
}

async function writeRoles(tx: Tx, eventId: string, eventRoles: Role[]) {
  const existing = await tx.select({ id: roles.id }).from(roles).where(eq(roles.eventId, eventId));
  if (existing.length > 0) {
    await tx.delete(roleMembers).where(inArray(roleMembers.roleId, existing.map((r) => r.id)));
    await tx.delete(roles).where(eq(roles.eventId, eventId));
  }
  for (const role of eventRoles) {
    const [roleRow] = await tx
      .insert(roles)
      .values({ eventId, key: role.key, label: role.label, description: role.description ?? null, min: role.min, max: role.max ?? null })
      .returning();
    if (role.members.length > 0 && roleRow) {
      await tx.insert(roleMembers).values(role.members.map((memberId) => ({ roleId: roleRow.id, memberId })));
    }
  }
}

/* The raw, trusted insert — no authorization, no validation. Only for callers
   that already hold a complete, vetted Event: createEvent below, and the seed
   script (whose fixtures carry their own ids, rsvps, and votes). */
export async function insertEvent(event: Event): Promise<Event> {
  await db.transaction(async (tx) => {
    await tx.insert(events).values({
      id: event.id,
      title: event.title,
      kind: event.kind ?? null,
      circleId: event.circleId,
      hostCircleId: event.hostCircleId ?? null,
      approvedAt: event.proposed ? null : new Date(),
      organizerId: event.organizerId,
      date: event.date,
      start: event.start,
      end: event.end,
      location: event.location,
      description: event.description,
    });
    if (event.rsvps.length > 0) {
      await tx.insert(eventRsvps).values(event.rsvps.map((memberId) => ({ eventId: event.id, memberId })));
    }
    if (event.votes && event.votes.length > 0) {
      await tx.insert(eventVotes).values(event.votes.map((memberId) => ({ eventId: event.id, memberId })));
    }
    if (event.roles && event.roles.length > 0) {
      await writeRoles(tx, event.id, event.roles);
    }
  });
  return event;
}

/* Create an event as `memberId`. The server decides the id, the organizer
   (always the caller), whether it starts as a proposal, and who starts out
   attending/voting — whatever the client might have said about those is not
   an input. A circle-hosted event opens with its proposer's vote, and is
   approved on the spot if that alone is a majority (a one-member circle). */
export async function createEvent(memberId: number, draft: EventDraft): Promise<Event> {
  const problem = validateEventDraft(draft);
  if (problem) throw new EventError(problem);
  const viewer = await viewerCircles(memberId);
  const { isRoot } = await assertCanPost(viewer, draft.circleId);
  const hostSize = draft.hostCircleId ? await assertCanHost(viewer, draft.hostCircleId, draft.circleId) : 0;
  if (draft.kind === "meeting" && isRoot) throw new EventError("A meeting needs a circle with its own members — pick a neighborhood or group.");
  const eventRoles = buildRoles(draft.roles ?? []);
  const isMeeting = draft.kind === "meeting";
  const hosted = !!draft.hostCircleId;
  // the creator attends their own event — except a slotted one, where people
  // sign up for slots instead, and a circle-hosted one, which opens for RSVPs
  // only once approved
  const attends = !hosted && (isMeeting || eventRoles.length === 0);
  return insertEvent({
    id: randomUUID(),
    title: draft.title.trim(),
    kind: draft.kind,
    circleId: draft.circleId,
    ...(draft.hostCircleId ? { hostCircleId: draft.hostCircleId } : {}),
    ...(hosted && majority(hostSize) > 1 ? { proposed: true } : {}),
    organizerId: memberId,
    date: draft.date,
    start: draft.start,
    end: draft.end,
    location: draft.location.trim(),
    description: draft.description.trim(),
    rsvps: attends ? [memberId] : [],
    // a meeting or proposal starts with its proposer's vote
    ...(isMeeting || hosted ? { votes: [memberId] } : {}),
    ...(eventRoles.length > 0 ? { roles: eventRoles } : {}),
  });
}

/* Edit an event's own details — organizer only. Deliberately can't change its
   circle or host circle (that would silently change who can see or vote on
   it), kind, organizer, or the rsvps/votes, which have their own actions. */
export async function updateEventDetails(memberId: number, id: string, details: EventDetails): Promise<Event> {
  const row = await loadVisible(memberId, id);
  if (row.organizerId !== memberId) throw new EventError("Only the person hosting this event can edit it.");
  const kind = row.kind ?? "ordinary";
  const problem = validateEventDraft({ ...details, kind, circleId: row.circleId, ...(row.hostCircleId ? { hostCircleId: row.hostCircleId } : {}) });
  if (problem) throw new EventError(problem);
  const existing = (await loadFull(id)).roles ?? [];
  await db.transaction(async (tx) => {
    await tx
      .update(events)
      .set({
        title: details.title.trim(),
        date: details.date,
        start: details.start,
        end: details.end,
        location: details.location.trim(),
        description: details.description.trim(),
      })
      .where(eq(events.id, id));
    await writeRoles(tx, id, buildRoles(details.roles, existing));
  });
  return loadFull(id);
}

// RSVP to (or leave) a plain event — not a meeting (those attend by voting)
// or a slotted event (those attend by taking a slot)
export async function setRsvp(memberId: number, id: string, going: boolean): Promise<Event> {
  const row = await loadVisible(memberId, id);
  assertLive(row);
  if (row.kind === "meeting") throw new EventError("Meetings are attended by voting.");
  const [slot] = await db.select({ id: roles.id }).from(roles).where(eq(roles.eventId, id)).limit(1);
  if (slot) throw new EventError("This event uses signup slots — take a slot instead.");
  if (going) await db.insert(eventRsvps).values({ eventId: id, memberId }).onConflictDoNothing();
  else await db.delete(eventRsvps).where(and(eq(eventRsvps.eventId, id), eq(eventRsvps.memberId, memberId)));
  return loadFull(id);
}

// vote on a meeting or on a circle-hosted proposal. For a meeting, voting and
// attending are one act, so the RSVP follows the vote. For a proposal a vote
// is an approval only (attending opens once it's live), and the vote that
// reaches a majority of the host circle approves it for good.
export async function setVote(memberId: number, id: string, voting: boolean): Promise<Event> {
  const row = await loadVisible(memberId, id);
  if (row.kind === "meeting") {
    await db.transaction(async (tx) => {
      if (voting) {
        await tx.insert(eventVotes).values({ eventId: id, memberId }).onConflictDoNothing();
        await tx.insert(eventRsvps).values({ eventId: id, memberId }).onConflictDoNothing();
      } else {
        await tx.delete(eventVotes).where(and(eq(eventVotes.eventId, id), eq(eventVotes.memberId, memberId)));
        await tx.delete(eventRsvps).where(and(eq(eventRsvps.eventId, id), eq(eventRsvps.memberId, memberId)));
      }
    });
    return loadFull(id);
  }
  const hostCircleId = row.hostCircleId;
  if (hostCircleId === null) throw new EventError("Only meetings and proposed events are voted on.");
  await db.transaction(async (tx) => {
    // lock the event so two members' votes can't each miss the other's and
    // leave a majority unnoticed
    const [locked] = await tx.select().from(events).where(eq(events.id, id)).for("update");
    if (!locked || locked.approvedAt !== null) throw new EventError("This event has already been approved.");
    if (voting) await tx.insert(eventVotes).values({ eventId: id, memberId }).onConflictDoNothing();
    else await tx.delete(eventVotes).where(and(eq(eventVotes.eventId, id), eq(eventVotes.memberId, memberId)));
    if (!voting) return;
    const [votes, members] = await Promise.all([
      tx.select().from(eventVotes).where(eq(eventVotes.eventId, id)),
      tx.select().from(circleMembers).where(eq(circleMembers.circleId, hostCircleId)),
    ]);
    if (votes.length >= majority(members.length)) await tx.update(events).set({ approvedAt: new Date() }).where(eq(events.id, id));
  });
  return loadFull(id);
}

// take a slot (leaving any other one — a person holds one at a time, and a
// slot with a max can be full) or leave the one they hold
export async function toggleRoleSlot(memberId: number, id: string, key: string): Promise<Event> {
  assertLive(await loadVisible(memberId, id));
  await db.transaction(async (tx) => {
    const eventRoles = await tx.select().from(roles).where(eq(roles.eventId, id));
    const target = eventRoles.find((r) => r.key === key);
    if (!target) throw new EventError("That slot doesn't exist.");
    const held = await tx
      .select()
      .from(roleMembers)
      .where(and(inArray(roleMembers.roleId, eventRoles.map((r) => r.id)), eq(roleMembers.memberId, memberId)));
    if (held.some((h) => h.roleId === target.id)) {
      await tx.delete(roleMembers).where(and(eq(roleMembers.roleId, target.id), eq(roleMembers.memberId, memberId)));
      return;
    }
    if (target.max != null) {
      const filled = await tx.select().from(roleMembers).where(eq(roleMembers.roleId, target.id));
      if (filled.length >= target.max) throw new EventError("That slot is full.");
    }
    if (held.length > 0) {
      await tx.delete(roleMembers).where(and(inArray(roleMembers.roleId, held.map((h) => h.roleId)), eq(roleMembers.memberId, memberId)));
    }
    await tx.insert(roleMembers).values({ roleId: target.id, memberId });
  });
  return loadFull(id);
}
