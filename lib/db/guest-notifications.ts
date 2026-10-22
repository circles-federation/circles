import { and, asc, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, type Tx } from "./client";
import { circles, eventGuestRsvps, eventSeries, eventShareLinks, events, guestNotifications, members } from "./schema";
import type { EventNotificationData } from "@/lib/email/templates.util";
import type { EventChange, GuestNoticeKind } from "@/lib/types";

/* The emails a guest is owed about the event they RSVPed to from a share link
   (lib/db/guest-rsvps.ts): that they're going, and later that it moved or was
   cancelled. Queued in the transaction that earns each, claimed and retried
   like the member queues in lib/db/notifications.ts, and sent by
   lib/notify.ts. Email only. Only confirmed guests are told. */

const MAX_ATTEMPTS = 5;
const RETRY_AFTER = sql`interval '5 minutes'`;

const confirmedGuests = (tx: Tx, eventId: string) =>
  tx.select({ id: eventGuestRsvps.id }).from(eventGuestRsvps).where(and(eq(eventGuestRsvps.eventId, eventId), isNotNull(eventGuestRsvps.confirmedAt)));

// those who haven't asked to stop hearing about it
const mailableGuestIds = (tx: Tx, eventId: string) =>
  tx
    .select({ id: eventGuestRsvps.id })
    .from(eventGuestRsvps)
    .where(and(eq(eventGuestRsvps.eventId, eventId), isNotNull(eventGuestRsvps.confirmedAt), isNull(eventGuestRsvps.emailsOffAt)));

// how many have said they're going, emails or not: an event with any is
// cancelled, not deleted
export async function confirmedGuestCount(tx: Tx, eventId: string): Promise<number> {
  return (await confirmedGuests(tx, eventId)).length;
}

export async function enqueueGuestConfirmation(tx: Tx, guestId: string): Promise<void> {
  await tx.insert(guestNotifications).values({ guestId, kind: "confirmed" }).onConflictDoNothing();
}

// the event's when or where changed: tell its guests, once. One still unsent
// keeps what it was before the earlier edit, since that's what they last heard;
// a sent one is replaced, so a later edit is news again.
export async function enqueueGuestUpdates(tx: Tx, eventId: string, change: EventChange): Promise<void> {
  const guests = await mailableGuestIds(tx, eventId);
  if (guests.length === 0) return;
  await tx
    .insert(guestNotifications)
    .values(guests.map((g) => ({ guestId: g.id, kind: "updated" as const, change })))
    .onConflictDoUpdate({
      target: [guestNotifications.guestId, guestNotifications.kind],
      set: { change, createdAt: sql`now()`, sentAt: null, attempts: 0, lastAttemptAt: null, lastError: null },
      setWhere: or(isNotNull(guestNotifications.sentAt), sql`${guestNotifications.attempts} >= ${MAX_ATTEMPTS}`),
    });
}

// it's off: tell its guests, and drop anything unsent that would now be wrong
export async function enqueueGuestCancellations(tx: Tx, eventId: string): Promise<void> {
  const guests = await mailableGuestIds(tx, eventId);
  if (guests.length === 0) return;
  const ids = guests.map((g) => g.id);
  await tx.delete(guestNotifications).where(and(inArray(guestNotifications.guestId, ids), isNull(guestNotifications.sentAt), sql`${guestNotifications.kind} <> 'cancelled'`));
  await tx
    .insert(guestNotifications)
    .values(ids.map((guestId) => ({ guestId, kind: "cancelled" as const })))
    .onConflictDoNothing();
}

export type GuestNotificationKey = { guestId: string; notice: GuestNoticeKind };

export type PendingGuestNotification = Omit<EventNotificationData, "url" | "notice"> &
  GuestNotificationKey & {
    eventId: string;
    guestName: string;
    email: string;
    // the page their share link opens, or null if the member who shared it is gone
    shareToken: string | null;
    cancelled: boolean;
  };

export async function claimGuestNotifications(limit: number): Promise<PendingGuestNotification[]> {
  const organizer = alias(members, "organizer");
  const hostCircle = alias(circles, "host_circle");
  return db.transaction(async (tx) => {
    const due = await tx
      .select({ guestId: guestNotifications.guestId, kind: guestNotifications.kind })
      .from(guestNotifications)
      .where(
        and(
          isNull(guestNotifications.sentAt),
          lt(guestNotifications.attempts, MAX_ATTEMPTS),
          or(isNull(guestNotifications.lastAttemptAt), lt(guestNotifications.lastAttemptAt, sql`now() - ${RETRY_AFTER}`))
        )
      )
      .orderBy(asc(guestNotifications.createdAt))
      .limit(limit)
      .for("update", { skipLocked: true });
    if (due.length === 0) return [];
    const isDue = or(...due.map((d) => and(eq(guestNotifications.guestId, d.guestId), eq(guestNotifications.kind, d.kind))));
    await tx
      .update(guestNotifications)
      .set({ attempts: sql`${guestNotifications.attempts} + 1`, lastAttemptAt: sql`now()` })
      .where(isDue);
    const rows = await tx
      .select({
        guestId: eventGuestRsvps.id,
        guestName: eventGuestRsvps.name,
        email: eventGuestRsvps.email,
        notice: guestNotifications.kind,
        change: guestNotifications.change,
        eventId: events.id,
        title: events.title,
        kind: events.kind,
        date: events.date,
        start: events.start,
        end: events.end,
        location: events.location,
        description: events.description,
        cancelled: sql<boolean>`${events.cancelledAt} is not null`,
        cancelledAutomatically: events.cancelledAutomatically,
        circleName: circles.name,
        circleType: circles.type,
        hostCircleName: hostCircle.name,
        hostCircleType: hostCircle.type,
        organizerName: organizer.name,
        shareToken: eventShareLinks.token,
        frequency: eventSeries.frequency,
        startsOn: eventSeries.startsOn,
        until: eventSeries.until,
      })
      .from(guestNotifications)
      .innerJoin(eventGuestRsvps, eq(eventGuestRsvps.id, guestNotifications.guestId))
      .innerJoin(events, eq(events.id, eventGuestRsvps.eventId))
      .innerJoin(circles, eq(circles.id, events.circleId))
      .innerJoin(organizer, eq(organizer.id, events.organizerId))
      .leftJoin(hostCircle, eq(hostCircle.id, events.hostCircleId))
      .leftJoin(eventSeries, eq(eventSeries.id, events.seriesId))
      .leftJoin(eventShareLinks, and(eq(eventShareLinks.eventId, events.id), eq(eventShareLinks.memberId, eventGuestRsvps.invitedBy)))
      .where(and(isDue, isNotNull(eventGuestRsvps.confirmedAt)));
    return rows.map(({ frequency, startsOn, until, change, hostCircleName, hostCircleType, circleName, circleType, ...r }) => {
      // a group is private: a stranger is never told its name
      const hiddenCircle = circleType === "group";
      return {
        ...r,
        ...(change ? { change } : {}),
        kind: r.kind ?? "ordinary",
        start: r.start.slice(0, 5),
        end: r.end.slice(0, 5),
        circleName: hiddenCircle ? "Circles" : circleName,
        circleType: hiddenCircle ? ("other" as const) : circleType,
        ...(hostCircleName && hostCircleType !== "group" ? { hostCircleName } : {}),
        proposed: false,
        votesNeeded: 0,
        ...(frequency !== null && startsOn !== null ? { repeat: { frequency, startsOn, ...(until !== null ? { until } : {}) } } : {}),
      };
    });
  });
}

const isRow = (n: GuestNotificationKey) => and(eq(guestNotifications.guestId, n.guestId), eq(guestNotifications.kind, n.notice));

export async function markGuestSent(n: GuestNotificationKey): Promise<void> {
  await db.update(guestNotifications).set({ sentAt: sql`now()`, lastError: null }).where(isRow(n));
}

export async function markGuestFailed(n: GuestNotificationKey, error: string): Promise<void> {
  await db.update(guestNotifications).set({ lastError: error.slice(0, 500) }).where(isRow(n));
}
