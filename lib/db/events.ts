import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "./client";
import { UserFacingError } from "./errors";
import { circleMembers, circles, eventRsvps, eventVotes, events, roleMembers, roles } from "./schema";
import { groupBy } from "./util";
import { roleKey, validateEventDraft, type EventDetails, type EventDraft, type RoleDraft } from "@/lib/events.util";
import type { Event, Role } from "@/lib/types";

/* An event belongs to one circle, and that circle is its audience: only the
   circle's members (and, for the city root, everyone) can see it, RSVP to it,
   or vote on it. This file is where that is enforced — not the UI, and not
   the caller. Reads only return events the given member may see; every write
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
      // only a meeting carries a votes array — ordinary events leave it undefined
      row.kind === "meeting" ? votesByEvent.get(row.id) || [] : undefined,
      rolesByEvent.get(row.id)
    )
  );
}

// the ids of every circle whose events this member may see: their own, plus
// the city root (everyone is implicitly in the city — see isCircleAudience in
// lib/circles.util.ts, which this mirrors)
async function audienceCircleIds(memberId: number): Promise<string[]> {
  const [memberships, [root]] = await Promise.all([
    db.select({ circleId: circleMembers.circleId }).from(circleMembers).where(eq(circleMembers.memberId, memberId)),
    db.select({ id: circles.id }).from(circles).where(isNull(circles.parentId)),
  ]);
  return [...memberships.map((m) => m.circleId), ...(root ? [root.id] : [])];
}

// every event this member may see — what the app sends to the browser, so an
// event outside their circles is never in their page data
export async function getEventsForMember(memberId: number): Promise<Event[]> {
  const ids = await audienceCircleIds(memberId);
  if (ids.length === 0) return [];
  const rows = await db.select().from(events).where(inArray(events.circleId, ids));
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
  if (!row || !(await audienceCircleIds(memberId)).includes(row.circleId)) throw new EventError("That event doesn't exist.");
  return row;
}

async function assertCanPost(memberId: number, circleId: string): Promise<{ isRoot: boolean }> {
  const [circle] = await db.select({ parentId: circles.parentId }).from(circles).where(eq(circles.id, circleId));
  if (!circle) throw new EventError("That circle doesn't exist.");
  if (!(await audienceCircleIds(memberId)).includes(circleId)) throw new EventError("You can only post to circles you belong to.");
  return { isRoot: circle.parentId === null };
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
   (always the caller), and who starts out attending/voting — whatever the
   client might have said about those is not an input. */
export async function createEvent(memberId: number, draft: EventDraft): Promise<Event> {
  const problem = validateEventDraft(draft);
  if (problem) throw new EventError(problem);
  const { isRoot } = await assertCanPost(memberId, draft.circleId);
  if (draft.kind === "meeting" && isRoot) throw new EventError("A meeting needs a circle with its own members — pick a neighborhood or group.");
  const eventRoles = buildRoles(draft.roles ?? []);
  const isMeeting = draft.kind === "meeting";
  return insertEvent({
    id: randomUUID(),
    title: draft.title.trim(),
    kind: draft.kind,
    circleId: draft.circleId,
    organizerId: memberId,
    date: draft.date,
    start: draft.start,
    end: draft.end,
    location: draft.location.trim(),
    description: draft.description.trim(),
    // the creator attends their own event — except a slotted one, where
    // people sign up for slots instead — and a meeting starts with its
    // proposer's vote
    rsvps: isMeeting || eventRoles.length === 0 ? [memberId] : [],
    ...(isMeeting ? { votes: [memberId] } : {}),
    ...(eventRoles.length > 0 ? { roles: eventRoles } : {}),
  });
}

/* Edit an event's own details — organizer only. Deliberately can't change its
   circle (that would silently change who can see it), kind, organizer, or the
   rsvps/votes, which have their own actions. */
export async function updateEventDetails(memberId: number, id: string, details: EventDetails): Promise<Event> {
  const row = await loadVisible(memberId, id);
  if (row.organizerId !== memberId) throw new EventError("Only the person hosting this event can edit it.");
  const kind = row.kind ?? "ordinary";
  const problem = validateEventDraft({ ...details, kind, circleId: row.circleId });
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
  if (row.kind === "meeting") throw new EventError("Meetings are attended by voting.");
  const [slot] = await db.select({ id: roles.id }).from(roles).where(eq(roles.eventId, id)).limit(1);
  if (slot) throw new EventError("This event uses signup slots — take a slot instead.");
  if (going) await db.insert(eventRsvps).values({ eventId: id, memberId }).onConflictDoNothing();
  else await db.delete(eventRsvps).where(and(eq(eventRsvps.eventId, id), eq(eventRsvps.memberId, memberId)));
  return loadFull(id);
}

// vote for (or withdraw a vote from) a meeting; voting and attending are one
// act, so the RSVP follows the vote
export async function setVote(memberId: number, id: string, voting: boolean): Promise<Event> {
  const row = await loadVisible(memberId, id);
  if (row.kind !== "meeting") throw new EventError("Only meetings are voted on.");
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

// take a slot (leaving any other one — a person holds one at a time, and a
// slot with a max can be full) or leave the one they hold
export async function toggleRoleSlot(memberId: number, id: string, key: string): Promise<Event> {
  await loadVisible(memberId, id);
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
