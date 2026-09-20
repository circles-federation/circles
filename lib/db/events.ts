import { eq, inArray } from "drizzle-orm";
import { db } from "./client";
import { eventRsvps, eventVotes, events, roleMembers, roles } from "./schema";
import { groupBy } from "./util";
import type { Event, Role } from "@/lib/types";

type EventRow = typeof events.$inferSelect;

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
    organizerId: row.organizerId ?? undefined,
    date: row.date,
    start: toClockTime(row.start),
    end: toClockTime(row.end),
    location: row.location,
    description: row.description,
    rsvps,
    membersOnly: row.membersOnly,
    roles: eventRoles,
    votes,
  };
}

async function attachRelations(rows: EventRow[]): Promise<Event[]> {
  if (rows.length === 0) return [];
  const [rsvpRows, voteRows, roleRows, roleMemberRows] = await Promise.all([
    db.select().from(eventRsvps),
    db.select().from(eventVotes),
    db.select().from(roles),
    db.select().from(roleMembers),
  ]);
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

export async function getEvents(): Promise<Event[]> {
  const rows = await db.select().from(events);
  return attachRelations(rows);
}

export async function getEventById(id: string): Promise<Event | null> {
  const [row] = await db.select().from(events).where(eq(events.id, id));
  if (!row) return null;
  const [full] = await attachRelations([row]);
  return full ?? null;
}

async function writeRoles(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], eventId: string, eventRoles: Role[]) {
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

export async function createEvent(event: Event): Promise<Event> {
  await db.transaction(async (tx) => {
    await tx.insert(events).values({
      id: event.id,
      title: event.title,
      kind: event.kind ?? null,
      circleId: event.circleId,
      organizerId: event.organizerId ?? null,
      date: event.date,
      start: event.start,
      end: event.end,
      location: event.location,
      description: event.description,
      membersOnly: !!event.membersOnly,
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

/* organizerId and roles are cleared by a patch that carries the key with an
   undefined value (the event form does this when an event switches to circle-
   hosted, or slots are turned off) — so those two check key presence, not
   `!== undefined` like the other fields. */
export async function updateEvent(id: string, patch: Partial<Event>): Promise<Event | null> {
  await db.transaction(async (tx) => {
    const columnPatch: Partial<typeof events.$inferInsert> = {};
    if (patch.title !== undefined) columnPatch.title = patch.title;
    if (patch.kind !== undefined) columnPatch.kind = patch.kind;
    if (patch.circleId !== undefined) columnPatch.circleId = patch.circleId;
    if ("organizerId" in patch) columnPatch.organizerId = patch.organizerId ?? null;
    if (patch.date !== undefined) columnPatch.date = patch.date;
    if (patch.start !== undefined) columnPatch.start = patch.start;
    if (patch.end !== undefined) columnPatch.end = patch.end;
    if (patch.location !== undefined) columnPatch.location = patch.location;
    if (patch.description !== undefined) columnPatch.description = patch.description;
    if (patch.membersOnly !== undefined) columnPatch.membersOnly = patch.membersOnly;

    if (Object.keys(columnPatch).length > 0) {
      await tx.update(events).set(columnPatch).where(eq(events.id, id));
    }
    if (patch.rsvps !== undefined) {
      await tx.delete(eventRsvps).where(eq(eventRsvps.eventId, id));
      if (patch.rsvps.length > 0) await tx.insert(eventRsvps).values(patch.rsvps.map((memberId) => ({ eventId: id, memberId })));
    }
    if (patch.votes !== undefined) {
      await tx.delete(eventVotes).where(eq(eventVotes.eventId, id));
      if (patch.votes.length > 0) await tx.insert(eventVotes).values(patch.votes.map((memberId) => ({ eventId: id, memberId })));
    }
    if ("roles" in patch) {
      await writeRoles(tx, id, patch.roles ?? []);
    }
  });
  return getEventById(id);
}
