import { and, eq, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, type Tx } from "./client";
import { circleMembers, circles, eventNotifications, members, events } from "./schema";
import type { EventNotificationData } from "@/lib/email/templates.util";
import { isPastEvent } from "@/lib/format.util";
import type { Event } from "@/lib/types";

/* The queue behind "email a circle's members about a new event". Deciding who
   is emailed lives here (next to the data), sending lives in lib/notify.ts —
   this file never touches SMTP. */

const MAX_ATTEMPTS = 5;
// a row can be tried again this long after its last attempt: the backoff after
// a failure, and the lease that keeps two drains off the same row
const RETRY_AFTER = sql`interval '5 minutes'`;

/* Queue the emails for a just-created event — inside the transaction that
   creates it. Today's one rule: an event whose circle has no sub-circles goes
   straight to every member of that circle who has an email, except whoever
   created it. A circle with sub-circles is a bigger, looser audience and is
   meant for a different, later rule; so is a circle-hosted event, whose
   proposal stage has its own audience — both queue nothing here. Nor does an
   event that's already over. Returns how many were queued. */
export async function enqueueEventNotifications(tx: Tx, event: Event): Promise<number> {
  if (event.hostCircleId || event.proposed || isPastEvent(event)) return 0;
  const [subCircle] = await tx.select({ id: circles.id }).from(circles).where(eq(circles.parentId, event.circleId)).limit(1);
  if (subCircle) return 0;
  const recipients = await tx
    .select({ id: members.id })
    .from(circleMembers)
    .innerJoin(members, eq(members.id, circleMembers.memberId))
    .where(and(eq(circleMembers.circleId, event.circleId), isNotNull(members.email), ne(members.id, event.organizerId)));
  if (recipients.length === 0) return 0;
  await tx.insert(eventNotifications).values(recipients.map((r) => ({ eventId: event.id, memberId: r.id }))).onConflictDoNothing();
  return recipients.length;
}

export type PendingEventNotification = Omit<EventNotificationData, "url"> & {
  eventId: string;
  memberId: number;
  email: string;
};

// Take up to `limit` unsent notifications that are due (never tried, or last
// tried long enough ago), stamp them as attempted, and return what's needed to
// write and send each email. SKIP LOCKED means concurrent callers — another
// drain, another server — get different rows rather than the same ones.
export async function claimEventNotifications(limit: number): Promise<PendingEventNotification[]> {
  const organizer = alias(members, "organizer");
  return db.transaction(async (tx) => {
    const due = await tx
      .select({ eventId: eventNotifications.eventId, memberId: eventNotifications.memberId })
      .from(eventNotifications)
      .where(
        and(
          isNull(eventNotifications.sentAt),
          lt(eventNotifications.attempts, MAX_ATTEMPTS),
          or(isNull(eventNotifications.lastAttemptAt), lt(eventNotifications.lastAttemptAt, sql`now() - ${RETRY_AFTER}`))
        )
      )
      .orderBy(eventNotifications.createdAt)
      .limit(limit)
      .for("update", { skipLocked: true });
    if (due.length === 0) return [];
    const isDue = or(...due.map((d) => and(eq(eventNotifications.eventId, d.eventId), eq(eventNotifications.memberId, d.memberId))));
    await tx
      .update(eventNotifications)
      .set({ attempts: sql`${eventNotifications.attempts} + 1`, lastAttemptAt: sql`now()` })
      .where(isDue);
    const rows = await tx
      .select({
        eventId: events.id,
        memberId: members.id,
        email: members.email,
        title: events.title,
        kind: events.kind,
        date: events.date,
        start: events.start,
        end: events.end,
        location: events.location,
        description: events.description,
        circleName: circles.name,
        organizerName: organizer.name,
      })
      .from(eventNotifications)
      .innerJoin(events, eq(events.id, eventNotifications.eventId))
      .innerJoin(circles, eq(circles.id, events.circleId))
      .innerJoin(members, eq(members.id, eventNotifications.memberId))
      .innerJoin(organizer, eq(organizer.id, events.organizerId))
      .where(isDue);
    return rows.flatMap((r) =>
      r.email
        ? [{ ...r, email: r.email, kind: r.kind ?? "ordinary", start: r.start.slice(0, 5), end: r.end.slice(0, 5) }]
        : []
    );
  });
}

export async function markNotificationSent(eventId: string, memberId: number): Promise<void> {
  await db
    .update(eventNotifications)
    .set({ sentAt: sql`now()`, lastError: null })
    .where(and(eq(eventNotifications.eventId, eventId), eq(eventNotifications.memberId, memberId)));
}

export async function markNotificationFailed(eventId: string, memberId: number, error: string): Promise<void> {
  await db
    .update(eventNotifications)
    .set({ lastError: error.slice(0, 500) })
    .where(and(eq(eventNotifications.eventId, eventId), eq(eventNotifications.memberId, memberId)));
}
