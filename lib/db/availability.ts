import { eq } from "drizzle-orm";
import { db } from "./client";
import { UserFacingError } from "./errors";
import { circleMembers, circles, members } from "./schema";
import { availabilityFor } from "@/lib/availability.util";
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
   there, since only a group's members know it exists. */
export async function getMeetingAvailability(memberId: number, circleId: string, date: string, start: string, end: string): Promise<MeetingAvailability> {
  if (!isDay(date) || !isClock(start) || !isClock(end)) throw new AvailabilityError("Pick a date and times first.");
  const [circle] = await db.select({ parentId: circles.parentId, type: circles.type, name: circles.name }).from(circles).where(eq(circles.id, circleId));
  const roster = circle ? await db.select({ id: members.id, availability: members.availability }).from(circleMembers).innerJoin(members, eq(members.id, circleMembers.memberId)).where(eq(circleMembers.circleId, circleId)) : [];
  if (!circle || !roster.some((m) => m.id === memberId)) {
    throw new AvailabilityError(circle && circle.type !== "group" ? `Only members of ${circle.name} can see who's available.` : "That circle doesn't exist.");
  }
  // the same circles a meeting can be held in (see createEvent)
  if (circle.parentId === null || !circleCanHoldMeetings(circle)) throw new AvailabilityError("That circle can't hold a meeting.");

  const result: MeetingAvailability = { available: [], unavailable: [], unknown: [] };
  for (const m of roster) {
    const { status, freeUntil } = availabilityFor(m.availability, date, start, end);
    if (status === "available") result.available.push(m.id);
    else if (status === "unknown") result.unknown.push(m.id);
    else result.unavailable.push(freeUntil === undefined ? { id: m.id } : { id: m.id, freeUntil });
  }
  return result;
}
