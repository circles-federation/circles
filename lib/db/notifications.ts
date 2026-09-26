import { and, eq, inArray, isNotNull, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, type Tx } from "./client";
import { circleMembers, circles, eventNotifications, eventSeries, members, events } from "./schema";
import type { DigestEventData, EventNotificationData } from "@/lib/email/templates.util";
import { isPastEvent } from "@/lib/format.util";
import { majority } from "@/lib/governance.util";
import type { Event, EventRepeat, NotificationKind } from "@/lib/types";

/* The queue behind "email a circle's members about a new event". Deciding who
   is emailed lives here (next to the data), sending lives in lib/notify.ts —
   this file never touches SMTP. */

const MAX_ATTEMPTS = 5;
// a row can be tried again this long after its last attempt: the backoff after
// a failure, and the lease that keeps two drains off the same row
const RETRY_AFTER = sql`interval '5 minutes'`;

// email addresses are optional on a member; nobody without one can be told
const hasEmail = isNotNull(members.email);

async function hasSubCircle(tx: Tx, circleId: string): Promise<boolean> {
  const [subCircle] = await tx.select({ id: circles.id }).from(circles).where(eq(circles.parentId, circleId)).limit(1);
  return !!subCircle;
}

/* Queue a notification of `kind` for the members of `circleId`, except
   `exceptId` — the person whose own action set this off, who needn't be told
   about it. The city root has no explicit roster (everyone is in it), so it
   means every member. How it's delivered depends on the circle: a circle with
   no sub-circles is small enough for an email of its own, right away; one with
   sub-circles — a neighborhood, the city — becomes a line in each member's
   once-a-day digest instead (lib/notify.ts's deliverDigests). `immediate`
   overrides that, for news that shouldn't wait a day. */
async function queueFor(tx: Tx, eventId: string, kind: NotificationKind, circleId: string, exceptId: number, immediate = false): Promise<number> {
  const [circle] = await tx.select({ parentId: circles.parentId }).from(circles).where(eq(circles.id, circleId));
  if (!circle) return 0;
  const digest = !immediate && (await hasSubCircle(tx, circleId));
  const recipients =
    circle.parentId === null
      ? await tx.select({ id: members.id }).from(members).where(and(hasEmail, ne(members.id, exceptId)))
      : await tx
          .select({ id: members.id })
          .from(circleMembers)
          .innerJoin(members, eq(members.id, circleMembers.memberId))
          .where(and(eq(circleMembers.circleId, circleId), hasEmail, ne(members.id, exceptId)));
  if (recipients.length === 0) return 0;
  await tx.insert(eventNotifications).values(recipients.map((r) => ({ eventId, memberId: r.id, kind, digest }))).onConflictDoNothing();
  return recipients.length;
}

// how an event repeats, for the email to say — from its series' columns (all
// null for a one-off, through the left join)
const seriesColumns = { frequency: eventSeries.frequency, startsOn: eventSeries.startsOn, until: eventSeries.until };
function toRepeat({ frequency, startsOn, until }: { frequency: EventRepeat["frequency"] | null; startsOn: string | null; until: string | null }) {
  return frequency !== null && startsOn !== null ? { repeat: { frequency, startsOn, ...(until !== null ? { until } : {}) } } : {};
}

/* Queue the notifications for a just-created event — inside the transaction
   that creates it. For a repeating event that's its first date only; the
   email says how it repeats, and later dates tell no one (see extendSeries in
   lib/db/events.ts). Who's told, by case:

   - An event or meeting hosted by a person ("new"): the members of the circle
     it's shown to.
   - A circle-hosted proposal ("proposed"): the members of the *host* circle —
     the only ones who can see it or vote on it. The circle it will be shown
     to hears nothing until it's approved.
   - A circle-hosted event approved the moment it's created (a host circle of
     one): announced to the circle it's shown to, as for any approval below.

   In each, the circle's size decides delivery (see queueFor). The person who
   created it is never told about it, and neither is anyone for an event that's
   already over. Returns how many were queued. */
export async function enqueueEventNotifications(tx: Tx, event: Event): Promise<number> {
  if (isPastEvent(event)) return 0;
  if (event.hostCircleId && event.proposed) return queueFor(tx, event.id, "proposed", event.hostCircleId, event.organizerId);
  if (event.hostCircleId) return enqueueProposalApprovalNotifications(tx, event, event.organizerId);
  return queueFor(tx, event.id, "new", event.circleId, event.organizerId);
}

/* A proposal was approved, so the event is now live for its circle: tell
   everyone in that circle. `actorId` is whoever's action approved it (the vote
   that reached a majority), who already knows. Anyone still waiting to be
   asked to vote on it — by email or in a digest — is dropped: it's decided.
   Runs in the approving transaction. */
export async function enqueueProposalApprovalNotifications(tx: Tx, event: Pick<Event, "id" | "circleId" | "date">, actorId: number): Promise<number> {
  await tx
    .delete(eventNotifications)
    .where(and(eq(eventNotifications.eventId, event.id), eq(eventNotifications.kind, "proposed"), isNull(eventNotifications.sentAt)));
  if (isPastEvent(event)) return 0;
  // always an email of its own, even to a big circle: this is what opens the
  // event up to them at all
  return queueFor(tx, event.id, "approved", event.circleId, actorId, true);
}

/* A meeting just reached its vote threshold: tell its circle it's approved.
   Called only by the vote that tips it over, and `actorId` (that voter)
   already knows. A meeting's approval is recomputed from its live votes
   rather than latched, so if votes are withdrawn and it's approved again the
   same member isn't told twice (one row per member and kind). */
export async function enqueueMeetingApprovalNotifications(tx: Tx, meeting: Pick<Event, "id" | "circleId" | "date">, actorId: number): Promise<number> {
  if (isPastEvent(meeting)) return 0;
  return queueFor(tx, meeting.id, "approved", meeting.circleId, actorId);
}

/* An event's organizer cancelled it: anything not yet sent about it (its
   "new" email, a digest line, an approval) is moot, so it's dropped. Runs in
   the cancelling transaction; sent rows are kept as the record they are. */
export async function withdrawEventNotifications(tx: Tx, eventId: string): Promise<void> {
  await tx.delete(eventNotifications).where(and(eq(eventNotifications.eventId, eventId), isNull(eventNotifications.sentAt)));
}

/* Tell the people who were going (see cancelEvent in lib/db/events.ts) that
   it's cancelled — always an email of its own, straight away, never a digest
   line a day later: they may be planning around it. Only those with an email
   address can be told. */
export async function enqueueCancellationNotifications(tx: Tx, eventId: string, memberIds: number[]): Promise<number> {
  if (memberIds.length === 0) return 0;
  const recipients = await tx.select({ id: members.id }).from(members).where(and(inArray(members.id, memberIds), hasEmail));
  if (recipients.length === 0) return 0;
  await tx
    .insert(eventNotifications)
    .values(recipients.map((r) => ({ eventId, memberId: r.id, kind: "cancelled" as const, digest: false })))
    .onConflictDoNothing();
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
  const hostCircle = alias(circles, "host_circle");
  return db.transaction(async (tx) => {
    const due = await tx
      .select({ eventId: eventNotifications.eventId, memberId: eventNotifications.memberId, kind: eventNotifications.kind })
      .from(eventNotifications)
      .where(
        and(
          // digest rows wait for their daily send (claimDigests)
          eq(eventNotifications.digest, false),
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
        circleType: circles.type,
        hostCircleName: hostCircle.name,
        approvedAt: events.approvedAt,
        hostSize: sql<number>`(select count(*)::int from circle_members where circle_id = ${events.hostCircleId})`,
        circleSize: sql<number>`(select count(*)::int from circle_members where circle_id = ${events.circleId})`,
        organizerName: organizer.name,
        ...seriesColumns,
      })
      .from(eventNotifications)
      .innerJoin(events, eq(events.id, eventNotifications.eventId))
      .innerJoin(circles, eq(circles.id, events.circleId))
      .innerJoin(members, eq(members.id, eventNotifications.memberId))
      .innerJoin(organizer, eq(organizer.id, events.organizerId))
      .leftJoin(hostCircle, eq(hostCircle.id, events.hostCircleId))
      .leftJoin(eventSeries, eq(eventSeries.id, events.seriesId))
      .where(isDue);
    return rows.flatMap(({ approvedAt, hostSize, circleSize, hostCircleName, frequency, startsOn, until, ...r }) =>
      r.email
        ? [
            {
              ...r,
              email: r.email,
              kind: r.kind ?? "ordinary",
              start: r.start.slice(0, 5),
              end: r.end.slice(0, 5),
              ...(hostCircleName ? { hostCircleName } : {}),
              ...toRepeat({ frequency, startsOn, until }),
              // read now, not when queued: it may have been approved since
              proposed: !!hostCircleName && approvedAt === null,
              // a proposal is voted on by its host circle, a meeting by its own
              votesNeeded: majority(hostCircleName ? hostSize : circleSize),
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

export type DigestKey = { eventId: string; memberId: number; notice: NotificationKind };

export interface PendingDigest {
  memberId: number;
  email: string;
  // every queue row this digest covers — marked sent (or failed) together
  keys: DigestKey[];
  events: (Omit<DigestEventData, "url"> & { id: string })[];
}

/* Take up to `limit` members' worth of due digest rows. A digest row is due
   once it was queued at or before `cutoff` (the most recent daily send time —
   see lib/notify.ts), so something that happened after this morning's send
   waits for tomorrow's. All of one member's due rows are taken together, so
   they get one email, not several. Rows are stamped as attempted and only
   retried after the usual delay. */
export async function claimDigests(cutoff: Date, limit: number): Promise<PendingDigest[]> {
  const organizer = alias(members, "organizer");
  const hostCircle = alias(circles, "host_circle");
  return db.transaction(async (tx) => {
    const due = and(
      eq(eventNotifications.digest, true),
      isNull(eventNotifications.sentAt),
      lt(eventNotifications.attempts, MAX_ATTEMPTS),
      lte(eventNotifications.createdAt, cutoff),
      or(isNull(eventNotifications.lastAttemptAt), lt(eventNotifications.lastAttemptAt, sql`now() - ${RETRY_AFTER}`))
    );
    const dueMembers = await tx.selectDistinct({ memberId: eventNotifications.memberId }).from(eventNotifications).where(due).orderBy(eventNotifications.memberId).limit(limit);
    if (dueMembers.length === 0) return [];
    const taken = await tx
      .select({ eventId: eventNotifications.eventId, memberId: eventNotifications.memberId, kind: eventNotifications.kind })
      .from(eventNotifications)
      .where(and(due, inArray(eventNotifications.memberId, dueMembers.map((m) => m.memberId))))
      .for("update", { skipLocked: true });
    if (taken.length === 0) return [];
    const isTaken = and(
      eq(eventNotifications.digest, true),
      sql`(${eventNotifications.eventId}, ${eventNotifications.memberId}, ${eventNotifications.kind}) in (${sql.join(taken.map((t) => sql`(${t.eventId}, ${t.memberId}, ${t.kind})`), sql`, `)})`
    );
    await tx.update(eventNotifications).set({ attempts: sql`${eventNotifications.attempts} + 1`, lastAttemptAt: sql`now()` }).where(isTaken);
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
        circleName: circles.name,
        hostCircleName: hostCircle.name,
        organizerName: organizer.name,
        ...seriesColumns,
      })
      .from(eventNotifications)
      .innerJoin(events, eq(events.id, eventNotifications.eventId))
      .innerJoin(circles, eq(circles.id, events.circleId))
      .innerJoin(members, eq(members.id, eventNotifications.memberId))
      .innerJoin(organizer, eq(organizer.id, events.organizerId))
      .leftJoin(hostCircle, eq(hostCircle.id, events.hostCircleId))
      .leftJoin(eventSeries, eq(eventSeries.id, events.seriesId))
      .where(isTaken);
    const byMember = new Map<number, PendingDigest>();
    for (const t of taken) {
      const key: DigestKey = { eventId: t.eventId, memberId: t.memberId, notice: t.kind };
      const digest = byMember.get(t.memberId);
      if (digest) digest.keys.push(key);
      else byMember.set(t.memberId, { memberId: t.memberId, email: "", keys: [key], events: [] });
    }
    for (const { hostCircleName, frequency, startsOn, until, ...r } of rows) {
      const digest = byMember.get(r.memberId);
      if (!digest) continue;
      digest.email = r.email ?? "";
      digest.events.push({
        ...r,
        id: r.eventId,
        kind: r.kind ?? "ordinary",
        start: r.start.slice(0, 5),
        end: r.end.slice(0, 5),
        ...(hostCircleName ? { hostCircleName } : {}),
        ...toRepeat({ frequency, startsOn, until }),
      });
    }
    return [...byMember.values()];
  });
}

export async function markDigestSent(keys: DigestKey[]): Promise<void> {
  for (const k of keys) await markNotificationSent(k);
}

export async function markDigestFailed(keys: DigestKey[], error: string): Promise<void> {
  for (const k of keys) await markNotificationFailed(k, error);
}
