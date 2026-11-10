import { and, eq, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "./client";
import { UserFacingError } from "./errors";
import { circleMembers, circles, eventRsvps, events, members, roleMembers, roles } from "./schema";
import { availabilityFor, clockMinutes } from "@/lib/availability.util";
import { circleCanHoldMeetings } from "@/lib/circles.util";
import { isClock, isDay } from "@/lib/events.util";
import type { MeetingAvailability } from "@/lib/types";

export class AvailabilityError extends UserFacingError {}

/* Who in a circle can make a meeting on `date` from `start` to `end`: the
   meeting form's list. Only members of the circle may ask, and only about the
   one time they name, so no one's schedule is ever sent anywhere, just where
   they stand against that time; someone who's never set theirs is Unknown.
   `memberId` is the session's, supplied by the action.

   A non-member of a group gets the same answer as for a circle that isn't
   there, since only a group's members know it exists.

   Someone who's going to another event (an RSVP or a slot) that overlaps the
   time is Not available however their schedule reads, flagged `busy` and never
   told which event, so what they're doing stays theirs. `excludeEventId` is the
   meeting being edited, which doesn't clash with itself. */
export async function getMeetingAvailability(memberId: number, circleId: string, date: string, start: string, end: string, excludeEventId?: string): Promise<MeetingAvailability> {
  if (!isDay(date) || !isClock(start) || !isClock(end)) throw new AvailabilityError("Pick a date and times first.");
  const [circle] = await db.select({ parentId: circles.parentId, type: circles.type, name: circles.name, features: circles.features }).from(circles).where(eq(circles.id, circleId));
  const roster = circle ? await db.select({ id: members.id, availability: members.availability }).from(circleMembers).innerJoin(members, eq(members.id, circleMembers.memberId)).where(eq(circleMembers.circleId, circleId)) : [];
  if (!circle || !roster.some((m) => m.id === memberId)) {
    throw new AvailabilityError(circle && circle.type !== "group" ? `Only members of ${circle.name} can see who's available.` : "That circle doesn't exist.");
  }
  // the same circles a meeting can be held in (see createEvent)
  if (circle.parentId === null || !circleCanHoldMeetings(circle)) throw new AvailabilityError("That circle can't hold a meeting.");

  const busy = await busyMembers(roster.map((m) => m.id), date, start, end, excludeEventId);

  const result: MeetingAvailability = { available: [], unavailable: [], unknown: [] };
  for (const m of roster) {
    const { status, freeUntil } = availabilityFor(m.availability, date, start, end);
    if (busy.has(m.id)) result.unavailable.push({ id: m.id, busy: true });
    else if (status === "available") result.available.push(m.id);
    else if (status === "unknown") result.unknown.push(m.id);
    else result.unavailable.push(freeUntil === undefined ? { id: m.id } : { id: m.id, freeUntil });
  }
  return result;
}

// who among `ids` is going to a live event on `date` that overlaps start–end.
// An event that runs past midnight is taken to end at the day's end, and one
// still awaiting its circle's consent isn't a commitment yet.
async function busyMembers(ids: number[], date: string, start: string, end: string, excludeEventId?: string): Promise<Set<number>> {
  if (ids.length === 0) return new Set();
  const from = clockMinutes(start);
  const to = clockMinutes(end);
  const live = and(
    eq(events.date, date),
    isNull(events.cancelledAt),
    excludeEventId ? ne(events.id, excludeEventId) : undefined,
    // governed (a meeting, or hosted by a circle) and not yet approved: only a proposal
    or(isNotNull(events.approvedAt), and(isNull(events.hostCircleId), ne(sql`coalesce(${events.kind}, '')`, "meeting")))
  );
  const going = await db.select({ memberId: eventRsvps.memberId, start: events.start, end: events.end }).from(eventRsvps).innerJoin(events, eq(events.id, eventRsvps.eventId)).where(and(live, inArray(eventRsvps.memberId, ids)));
  const slots = await db.select({ memberId: roleMembers.memberId, start: events.start, end: events.end }).from(roleMembers).innerJoin(roles, eq(roles.id, roleMembers.roleId)).innerJoin(events, eq(events.id, roles.eventId)).where(and(live, inArray(roleMembers.memberId, ids)));
  const busy = new Set<number>();
  for (const e of [...going, ...slots]) {
    const s = clockMinutes(e.start.slice(0, 5));
    const eEnd = clockMinutes(e.end.slice(0, 5));
    const f = eEnd <= s ? 24 * 60 : eEnd;
    if (s < to && from < f) busy.add(e.memberId);
  }
  return busy;
}
