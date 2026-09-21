import { and, eq, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, type Tx } from "./client";
import { circleMembers, circles, eventNotifications, members, events } from "./schema";
import type { EventNotificationData } from "@/lib/email/templates.util";
import { isPastEvent } from "@/lib/format.util";
import { majority } from "@/lib/governance.util";
import type { Event, NotificationKind } from "@/lib/types";

/* The queue behind "email a circle's members about a new event". Deciding who
   is emailed lives here (next to the data), sending lives in lib/notify.ts —
   this file never touches SMTP. */

const MAX_ATTEMPTS = 5;
// a row can be tried again this long after its last attempt: the backoff after
// a failure, and the lease that keeps two drains off the same row
const RETRY_AFTER = sql`interval '5 minutes'`;

// email addresses are optional on a member; nobody without one can be told
const hasEmail = isNotNull(members.email);

/* Queue an email of `kind` to the members of `circleId`, except `exceptId` —
   the person whose own action set this off, who needn't be told about it. The
   city root has no explicit roster (everyone is in it), so it means every
   member. `leafOnly` holds the email back when the circle has sub-circles: a
   bigger, looser audience meant for a different, later rule. */
async function queueFor(tx: Tx, eventId: string, kind: NotificationKind, circleId: string, exceptId: number, leafOnly: boolean): Promise<number> {
  if (leafOnly) {
    const [subCircle] = await tx.select({ id: circles.id }).from(circles).where(eq(circles.parentId, circleId)).limit(1);
    if (subCircle) return 0;
  }
  const [circle] = await tx.select({ parentId: circles.parentId }).from(circles).where(eq(circles.id, circleId));
  if (!circle) return 0;
  const recipients =
    circle.parentId === null
      ? await tx.select({ id: members.id }).from(members).where(and(hasEmail, ne(members.id, exceptId)))
      : await tx
          .select({ id: members.id })
          .from(circleMembers)
          .innerJoin(members, eq(members.id, circleMembers.memberId))
          .where(and(eq(circleMembers.circleId, circleId), hasEmail, ne(members.id, exceptId)));
  if (recipients.length === 0) return 0;
  await tx.insert(eventNotifications).values(recipients.map((r) => ({ eventId, memberId: r.id, kind }))).onConflictDoNothing();
  return recipients.length;
}

/* Queue the emails for a just-created event — inside the transaction that
   creates it. Who hears, by case:

   - An event hosted by a person: the members of the circle it's shown to, if
     that circle has no sub-circles.
   - A circle-hosted proposal: the members of the *host* circle (the only ones
     who can see it or vote on it), if that circle has no sub-circles. The
     circle it will be shown to hears nothing until it's approved.
   - A circle-hosted event approved the moment it's created (a host circle of
     one): announced to the circle it's shown to, as for any approval below.

   The person who created it is never emailed about it, and neither is anyone
   for an event that's already over. Circles with sub-circles are left for a
   later rule. Returns how many were queued. */
export async function enqueueEventNotifications(tx: Tx, event: Event): Promise<number> {
  if (isPastEvent(event)) return 0;
  if (event.hostCircleId && event.proposed) return queueFor(tx, event.id, "proposed", event.hostCircleId, event.organizerId, true);
  if (event.hostCircleId) return enqueueApprovalNotifications(tx, event, event.organizerId);
  return queueFor(tx, event.id, "new", event.circleId, event.organizerId, true);
}

/* A proposal was approved, so the event is now live for its circle: tell
   everyone in that circle — no sub-circle condition, since a circle-hosted
   event's audience is typically a larger circle like a whole neighborhood,
   which always has sub-circles. `actorId` is whoever's action approved it (the
   vote that reached a majority), who already knows. Anyone still waiting to be
   asked to vote is dropped: it's decided. Runs in the approving transaction. */
export async function enqueueApprovalNotifications(tx: Tx, event: Pick<Event, "id" | "circleId" | "date">, actorId: number): Promise<number> {
  await tx
    .delete(eventNotifications)
    .where(and(eq(eventNotifications.eventId, event.id), eq(eventNotifications.kind, "proposed"), isNull(eventNotifications.sentAt)));
  if (isPastEvent(event)) return 0;
  return queueFor(tx, event.id, "approved", event.circleId, actorId, false);
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
  const hostCircle = alias(circles, "host_circle");
  return db.transaction(async (tx) => {
    const due = await tx
      .select({ eventId: eventNotifications.eventId, memberId: eventNotifications.memberId, kind: eventNotifications.kind })
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
    const isDue = or(
      ...due.map((d) => and(eq(eventNotifications.eventId, d.eventId), eq(eventNotifications.memberId, d.memberId), eq(eventNotifications.kind, d.kind)))
    );
    await tx
      .update(eventNotifications)
      .set({ attempts: sql`${eventNotifications.attempts} + 1`, lastAttemptAt: sql`now()` })
      .where(isDue);
    const rows = await tx
      .select({
        eventId: events.id,
        memberId: members.id,
        notice: eventNotifications.kind,
        email: members.email,
        title: events.title,
        kind: events.kind,
        date: events.date,
        start: events.start,
        end: events.end,
        location: events.location,
        description: events.description,
        circleName: circles.name,
        hostCircleName: hostCircle.name,
        approvedAt: events.approvedAt,
        hostSize: sql<number>`(select count(*)::int from circle_members where circle_id = ${events.hostCircleId})`,
        organizerName: organizer.name,
      })
      .from(eventNotifications)
      .innerJoin(events, eq(events.id, eventNotifications.eventId))
      .innerJoin(circles, eq(circles.id, events.circleId))
      .innerJoin(members, eq(members.id, eventNotifications.memberId))
      .innerJoin(organizer, eq(organizer.id, events.organizerId))
      .leftJoin(hostCircle, eq(hostCircle.id, events.hostCircleId))
      .where(isDue);
    return rows.flatMap(({ approvedAt, hostSize, hostCircleName, ...r }) =>
      r.email
        ? [
            {
              ...r,
              email: r.email,
              kind: r.kind ?? "ordinary",
              start: r.start.slice(0, 5),
              end: r.end.slice(0, 5),
              ...(hostCircleName ? { hostCircleName } : {}),
              // read now, not when queued: it may have been approved since
              proposed: !!hostCircleName && approvedAt === null,
              votesNeeded: majority(hostSize),
            },
          ]
        : []
    );
  });
}

const isRow = (n: { eventId: string; memberId: number; notice: NotificationKind }) =>
  and(eq(eventNotifications.eventId, n.eventId), eq(eventNotifications.memberId, n.memberId), eq(eventNotifications.kind, n.notice));

export async function markNotificationSent(n: { eventId: string; memberId: number; notice: NotificationKind }): Promise<void> {
  await db.update(eventNotifications).set({ sentAt: sql`now()`, lastError: null }).where(isRow(n));
}

export async function markNotificationFailed(n: { eventId: string; memberId: number; notice: NotificationKind }, error: string): Promise<void> {
  await db.update(eventNotifications).set({ lastError: error.slice(0, 500) }).where(isRow(n));
}
