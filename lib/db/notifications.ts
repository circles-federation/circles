import { and, asc, eq, gte, inArray, isNotNull, isNull, lt, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, type Tx } from "./client";
import {
  announcementNotifications,
  circleMembers,
  circleProposals,
  circleResources,
  circles,
  eventAgendaItems,
  eventNotifications,
  eventRsvps,
  eventSeries,
  members,
  events,
  proposalNotifications,
  proposalResponses,
  pushSubscriptions,
  roleMembers,
  roles,
} from "./schema";
import { groupBy } from "./util";
import type { AnnouncementEmailData, DigestEventData, EventNotificationData, ProposalEmailData } from "@/lib/email/templates.util";
import { REMINDER_HOURS } from "@/lib/events.util";
import { isPastEvent } from "@/lib/format.util";
import { majority } from "@/lib/governance.util";
import { localDay } from "@/lib/recurrence.util";
import type { AgendaItem, Event, EventChange, EventRepeat, NotificationChannel, NotificationKind, ProposalNoticeKind } from "@/lib/types";

/* The queues behind "tell a circle's members about a new event" (and the
   rest of an event's news) and "…about a new announcement". Deciding who is
   told lives here (next to the data), sending lives in lib/notify.ts — this
   file never touches SMTP, a push service or the SMS provider. Each member is told on every
   channel they can be reached by (see channelsFor), one queue row each. */

const MAX_ATTEMPTS = 5;
// a row can be tried again this long after its last attempt: the backoff after
// a failure, and the lease that keeps two drains off the same row
const RETRY_AFTER = sql`interval '5 minutes'`;

type Recipient = { memberId: number; channel: NotificationChannel };

/* How each member matching `who` can be told: by email if they have an
   address (it's optional on a member), by push if they've turned it on for a
   device, unless `push` is false (a digest line's push is only a nudge sent
   with the email), and by text if they've confirmed a mobile number — in
   each case only if they haven't turned that channel off (Settings →
   Notifications; texts also stop when they reply STOP). Someone with none of
   them can't be told at all. */
async function channelsFor(tx: Tx, who: SQL | undefined, { push = true } = {}): Promise<Recipient[]> {
  const rows = await tx
    .select({
      id: members.id,
      email: sql<boolean>`${members.email} is not null and ${members.notifyEmail}`,
      push: sql<boolean>`${members.notifyPush} and exists (select 1 from ${pushSubscriptions} where ${pushSubscriptions.memberId} = ${members.id})`,
      sms: sql<boolean>`${members.phone} is not null and ${members.notifySms}`,
    })
    .from(members)
    .where(who);
  return rows.flatMap((r): Recipient[] => [
    ...(r.email ? [{ memberId: r.id, channel: "email" as const }] : []),
    ...(push && r.push ? [{ memberId: r.id, channel: "push" as const }] : []),
    ...(r.sms ? [{ memberId: r.id, channel: "sms" as const }] : []),
  ]);
}

// a member's address to email, or null if they've turned email off since this
// was queued: the drain then drops the row instead of sending it
const emailIfWanted = sql<string | null>`case when ${members.notifyEmail} then ${members.email} end`;
// the same for a text: their number, unless texts are off or it's been removed
const phoneIfWanted = sql<string | null>`case when ${members.notifySms} then ${members.phone} end`;

// how many members `recipients` reaches, on whatever channels
const membersIn = (recipients: Recipient[]) => new Set(recipients.map((r) => r.memberId)).size;

// the members of circleId (an explicit roster: not for the city root)
const inCircle = (circleId: string) => inArray(members.id, db.select({ id: circleMembers.memberId }).from(circleMembers).where(eq(circleMembers.circleId, circleId)));

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
   once-a-day digest instead (lib/notify.ts's deliverDigests), by email and by
   text. `immediate` overrides that, for news that shouldn't wait a day. A
   digest line has no push row: its push is a nudge sent with the digest
   email itself. */
async function queueFor(tx: Tx, eventId: string, kind: NotificationKind, circleId: string, exceptId: number, immediate = false): Promise<number> {
  const [circle] = await tx.select({ parentId: circles.parentId }).from(circles).where(eq(circles.id, circleId));
  if (!circle) return 0;
  const digest = !immediate && (await hasSubCircle(tx, circleId));
  const notMe = ne(members.id, exceptId);
  const recipients = await channelsFor(tx, circle.parentId === null ? notMe : and(inCircle(circleId), notMe), { push: !digest });
  if (recipients.length === 0) return 0;
  await tx.insert(eventNotifications).values(recipients.map((r) => ({ eventId, ...r, kind, digest }))).onConflictDoNothing();
  return membersIn(recipients);
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
   it's cancelled — always on its own, straight away, never a digest line a
   day later: they may be planning around it. */
export async function enqueueCancellationNotifications(tx: Tx, eventId: string, memberIds: number[]): Promise<number> {
  if (memberIds.length === 0) return 0;
  const recipients = await channelsFor(tx, inArray(members.id, memberIds));
  if (recipients.length === 0) return 0;
  await tx
    .insert(eventNotifications)
    .values(recipients.map((r) => ({ eventId, ...r, kind: "cancelled" as const, digest: false })))
    .onConflictDoNothing();
  return membersIn(recipients);
}

/* Tell the people going (see goingTo in lib/db/events.ts) that the organizer
   moved it — a new date, time or place. On its own, straight away, like a
   cancellation. `change` is when and where it was before. A member still
   waiting on an unsent one for this event keeps it, along with what it was
   before *that* edit, since that's what they last heard; the email is rendered
   from the event as it stands when it goes out. One already sent is replaced,
   so a later edit is news again. */
export async function enqueueUpdateNotifications(tx: Tx, eventId: string, memberIds: number[], change: EventChange): Promise<number> {
  if (memberIds.length === 0) return 0;
  const recipients = await channelsFor(tx, inArray(members.id, memberIds));
  if (recipients.length === 0) return 0;
  await tx
    .insert(eventNotifications)
    .values(recipients.map((r) => ({ eventId, ...r, kind: "updated" as const, digest: false, change })))
    .onConflictDoUpdate({
      target: [eventNotifications.eventId, eventNotifications.memberId, eventNotifications.kind, eventNotifications.channel],
      set: { change, createdAt: sql`now()`, sentAt: null, attempts: 0, lastAttemptAt: null, lastError: null },
      // replace a sent one, or one that ran out of attempts; leave a pending one be
      setWhere: or(isNotNull(eventNotifications.sentAt), sql`${eventNotifications.attempts} >= ${MAX_ATTEMPTS}`),
    });
  return membersIn(recipients);
}

// a timestamp-without-zone literal for `d` in this machine's timezone, to set
// against an event's date + start, which are the community's wall-clock time
export const wallClock = (d: Date) => `${localDay(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;

// everyone going to an event, organizer included: its RSVPs (a meeting's
// voters among them) and its slot holders
async function going(tx: Tx, eventId: string): Promise<number[]> {
  const [rsvpRows, slotRows] = await Promise.all([
    tx.select({ id: eventRsvps.memberId }).from(eventRsvps).where(eq(eventRsvps.eventId, eventId)),
    tx.select({ id: roleMembers.memberId }).from(roleMembers).innerJoin(roles, eq(roles.id, roleMembers.roleId)).where(eq(roles.eventId, eventId)),
  ]);
  return [...new Set([...rsvpRows, ...slotRows].map((r) => r.id))];
}

/* Queue a reminder for everyone going to each event that starts within the
   next REMINDER_HOURS and hasn't had one — on its own, never a digest line. Run by the poller (lib/notify.ts), since an event comes into range
   just by time passing. Who's going is read at that moment, so someone who
   signs up later, already this close, isn't reminded of what they just chose.
   A cancelled event, a proposal, and a meeting still short of its votes are
   passed over; the last is looked at again until it's approved or has begun.
   Each event is locked while it's done, so two servers can't both queue it.
   Returns how many reminders were queued. */
export async function enqueueReminders(now: Date = new Date()): Promise<number> {
  const later = new Date(now.getTime() + REMINDER_HOURS * 60 * 60 * 1000);
  const startsAt = sql`(${events.date} + ${events.start})`;
  const due = await db
    .select({
      id: events.id,
      kind: events.kind,
      approvedByRole: events.approvedByRole,
      votes: sql<number>`(select count(*)::int from event_votes where event_id = ${events.id})`,
      circleSize: sql<number>`(select count(*)::int from circle_members where circle_id = ${events.circleId})`,
    })
    .from(events)
    .where(
      and(
        isNull(events.remindedAt),
        isNull(events.cancelledAt),
        isNotNull(events.approvedAt),
        // the dates it can fall on, so the date index narrows this to a day
        // or two before the start time (which no index covers) is compared
        gte(events.date, localDay(now)),
        lte(events.date, localDay(later)),
        sql`${startsAt} > ${wallClock(now)}::timestamp`,
        sql`${startsAt} <= ${wallClock(later)}::timestamp`
      )
    );
  const ready = due.filter((e) => e.kind !== "meeting" || e.approvedByRole !== null || e.votes >= majority(e.circleSize));
  let queued = 0;
  for (const { id } of ready) {
    queued += await db.transaction(async (tx) => {
      const [row] = await tx.select({ remindedAt: events.remindedAt }).from(events).where(eq(events.id, id)).for("update", { skipLocked: true });
      if (!row || row.remindedAt !== null) return 0;
      await tx.update(events).set({ remindedAt: new Date() }).where(eq(events.id, id));
      const goingIds = await going(tx, id);
      const recipients = goingIds.length > 0 ? await channelsFor(tx, inArray(members.id, goingIds)) : [];
      if (recipients.length === 0) return 0;
      await tx
        .insert(eventNotifications)
        .values(recipients.map((r) => ({ eventId: id, ...r, kind: "reminder" as const, digest: false })))
        // one sent before the event was moved further out is due again
        .onConflictDoUpdate({
          target: [eventNotifications.eventId, eventNotifications.memberId, eventNotifications.kind, eventNotifications.channel],
          set: { createdAt: sql`now()`, sentAt: null, attempts: 0, lastAttemptAt: null, lastError: null },
        });
      return membersIn(recipients);
    });
  }
  return queued;
}

/* Tell an event's host (its organizer, and for a circle-hosted one every
   member of the host circle) that a required slot is still short an hour
   before it starts, so they can find someone to cover it — see
   checkUnfilledSlots in lib/db/events.ts. On its own, straight away. One
   already sent is due again, for an event that was moved since. */
export async function enqueueSlotWarnings(tx: Tx, eventId: string, memberIds: number[]): Promise<number> {
  if (memberIds.length === 0) return 0;
  const recipients = await channelsFor(tx, inArray(members.id, memberIds));
  if (recipients.length === 0) return 0;
  await tx
    .insert(eventNotifications)
    .values(recipients.map((r) => ({ eventId, ...r, kind: "short" as const, digest: false })))
    .onConflictDoUpdate({
      target: [eventNotifications.eventId, eventNotifications.memberId, eventNotifications.kind, eventNotifications.channel],
      set: { createdAt: sql`now()`, sentAt: null, attempts: 0, lastAttemptAt: null, lastError: null },
    });
  return membersIn(recipients);
}

// an event was moved: a warning not yet sent would name the old time
export async function withdrawSlotWarnings(tx: Tx, eventId: string): Promise<void> {
  await tx
    .delete(eventNotifications)
    .where(and(eq(eventNotifications.eventId, eventId), eq(eventNotifications.kind, "short"), isNull(eventNotifications.sentAt)));
}

// an event was moved: a reminder not yet sent would name the old time, so
// it's dropped (updateEventDetails decides whether one is due again)
export async function withdrawReminders(tx: Tx, eventId: string): Promise<void> {
  await tx
    .delete(eventNotifications)
    .where(and(eq(eventNotifications.eventId, eventId), eq(eventNotifications.kind, "reminder"), isNull(eventNotifications.sentAt)));
}

// one queue row: what it's about, who it's for, and which way it goes
export type NotificationKey = { eventId: string; memberId: number; notice: NotificationKind; channel: NotificationChannel };

export type PendingEventNotification = Omit<EventNotificationData, "url"> &
  NotificationKey & {
    // null if they've since removed their address: an email row is then dropped
    email: string | null;
    // likewise their number, for a text
    phone: string | null;
  };

// Take up to `limit` unsent notifications on `channel` that are due (never
// tried, or last tried long enough ago), stamp them as attempted, and return
// what's needed to write and send each one. SKIP LOCKED means concurrent
// callers — another drain, another server — get different rows rather than
// the same ones.
export async function claimEventNotifications(limit: number, channel: NotificationChannel): Promise<PendingEventNotification[]> {
  const organizer = alias(members, "organizer");
  const hostCircle = alias(circles, "host_circle");
  return db.transaction(async (tx) => {
    const due = await tx
      .select({ eventId: eventNotifications.eventId, memberId: eventNotifications.memberId, kind: eventNotifications.kind })
      .from(eventNotifications)
      .where(
        and(
          eq(eventNotifications.channel, channel),
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
    const isDue = and(
      eq(eventNotifications.channel, channel),
      or(...due.map((d) => and(eq(eventNotifications.eventId, d.eventId), eq(eventNotifications.memberId, d.memberId), eq(eventNotifications.kind, d.kind))))
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
        channel: eventNotifications.channel,
        change: eventNotifications.change,
        email: emailIfWanted,
        phone: phoneIfWanted,
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
        approvedByRole: events.approvedByRole,
        cancelledAutomatically: events.cancelledAutomatically,
        autoCancel: events.autoCancel,
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
    // a meeting's email lists its agenda (it has no description)
    const meetingIds = [...new Set(rows.filter((r) => r.kind === "meeting").map((r) => r.eventId))];
    const agendaRows = meetingIds.length > 0
      ? await tx.select().from(eventAgendaItems).where(inArray(eventAgendaItems.eventId, meetingIds)).orderBy(asc(eventAgendaItems.position))
      : [];
    const agendaByEvent = groupBy(agendaRows, (a) => a.eventId, (a): AgendaItem => ({ category: a.category, title: a.title, ...(a.details !== null ? { details: a.details } : {}) }));
    // a reminder names the reader's own slots and any still short of people
    // so does a host's warning of a short slot, and an automatic cancellation
    const withSlots = (r: { notice: NotificationKind; cancelledAutomatically: boolean }) => r.notice === "reminder" || r.notice === "short" || (r.notice === "cancelled" && r.cancelledAutomatically);
    const reminderIds = [...new Set(rows.filter(withSlots).map((r) => r.eventId))];
    const slotRows = reminderIds.length > 0
      ? await tx
          .select({
            eventId: roles.eventId,
            label: roles.label,
            min: roles.min,
            holders: sql<number[]>`(select coalesce(array_agg(member_id), '{}') from role_members where role_id = ${roles.id})`,
          })
          .from(roles)
          .where(inArray(roles.eventId, reminderIds))
          .orderBy(asc(roles.id))
      : [];
    const slotsByEvent = groupBy(slotRows, (s) => s.eventId, (s) => s);
    const reminderSlots = (eventId: string, memberId: number) => {
      const slots = slotsByEvent.get(eventId) ?? [];
      return {
        mySlots: slots.filter((s) => s.holders.includes(memberId)).map((s) => s.label),
        openSlots: slots.filter((s) => s.holders.length < s.min).map((s) => ({ label: s.label, min: s.min, filled: s.holders.length })),
      };
    };
    return rows.map(({ approvedAt, approvedByRole, hostSize, circleSize, hostCircleName, frequency, startsOn, until, change, ...r }) => ({
              ...r,
              ...(change ? { change } : {}),
              kind: r.kind ?? "ordinary",
              start: r.start.slice(0, 5),
              end: r.end.slice(0, 5),
              ...(hostCircleName ? { hostCircleName } : {}),
              ...(approvedByRole ? { approvedByRole } : {}),
              ...toRepeat({ frequency, startsOn, until }),
              ...(r.kind === "meeting" ? { agenda: agendaByEvent.get(r.eventId) ?? [] } : {}),
              ...(withSlots(r) ? reminderSlots(r.eventId, r.memberId) : {}),
              // read now, not when queued: it may have been approved since
              proposed: !!hostCircleName && approvedAt === null,
              // a proposal is voted on by its host circle, a meeting by its own
              votesNeeded: majority(hostCircleName ? hostSize : circleSize),
    }));
  });
}

const isRow = (n: NotificationKey) =>
  and(eq(eventNotifications.eventId, n.eventId), eq(eventNotifications.memberId, n.memberId), eq(eventNotifications.kind, n.notice), eq(eventNotifications.channel, n.channel));

export async function markNotificationSent(n: NotificationKey): Promise<void> {
  await db.update(eventNotifications).set({ sentAt: sql`now()`, lastError: null }).where(isRow(n));
}

export async function markNotificationFailed(n: NotificationKey, error: string): Promise<void> {
  await db.update(eventNotifications).set({ lastError: error.slice(0, 500) }).where(isRow(n));
}

// a digest goes out by email and by text, never by push (see queueFor)
export type DigestChannel = "email" | "sms";
export type DigestKey = NotificationKey & { channel: DigestChannel };

export interface PendingDigest {
  memberId: number;
  // their address or number, as the channel needs; "" if they've since
  // removed it or turned that channel off, and the digest is then dropped
  address: string;
  // every queue row this digest covers — marked sent (or failed) together
  keys: DigestKey[];
  events: (Omit<DigestEventData, "url"> & { id: string })[];
}

/* Take up to `limit` members' worth of due digest rows. A digest row is due
   once it was queued at or before `cutoff` (the most recent daily send time —
   see lib/notify.ts), so something that happened after this morning's send
   waits for tomorrow's. All of one member's due rows are taken together, so
   they get one email (or text), not several. Rows are stamped as attempted
   and only retried after the usual delay. */
export async function claimDigests(cutoff: Date, limit: number, channel: DigestChannel): Promise<PendingDigest[]> {
  const organizer = alias(members, "organizer");
  const hostCircle = alias(circles, "host_circle");
  return db.transaction(async (tx) => {
    const due = and(
      eq(eventNotifications.digest, true),
      eq(eventNotifications.channel, channel),
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
      eq(eventNotifications.channel, channel),
      sql`(${eventNotifications.eventId}, ${eventNotifications.memberId}, ${eventNotifications.kind}) in (${sql.join(taken.map((t) => sql`(${t.eventId}, ${t.memberId}, ${t.kind})`), sql`, `)})`
    );
    await tx.update(eventNotifications).set({ attempts: sql`${eventNotifications.attempts} + 1`, lastAttemptAt: sql`now()` }).where(isTaken);
    const rows = await tx
      .select({
        eventId: events.id,
        memberId: members.id,
        notice: eventNotifications.kind,
        email: emailIfWanted,
        phone: phoneIfWanted,
        title: events.title,
        kind: events.kind,
        date: events.date,
        start: events.start,
        end: events.end,
        location: events.location,
        circleName: circles.name,
        hostCircleName: hostCircle.name,
        approvedByRole: events.approvedByRole,
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
      const key: DigestKey = { eventId: t.eventId, memberId: t.memberId, notice: t.kind, channel };
      const digest = byMember.get(t.memberId);
      if (digest) digest.keys.push(key);
      else byMember.set(t.memberId, { memberId: t.memberId, address: "", keys: [key], events: [] });
    }
    for (const { hostCircleName, approvedByRole, frequency, startsOn, until, email, phone, ...r } of rows) {
      const digest = byMember.get(r.memberId);
      if (!digest) continue;
      digest.address = (channel === "email" ? email : phone) ?? "";
      digest.events.push({
        ...r,
        id: r.eventId,
        kind: r.kind ?? "ordinary",
        start: r.start.slice(0, 5),
        end: r.end.slice(0, 5),
        ...(hostCircleName ? { hostCircleName } : {}),
        ...(approvedByRole ? { approvedByRole } : {}),
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

/* An announcement was just posted to a circle's bulletin: tell each of the
   circle's members, except the poster. Always on its own — a bulletin is only
   on a circle with a page of its own, never a neighborhood or the city, the
   audiences big enough for the digest. Runs in the transaction that posts it.
   Returns how many members were queued. */
export async function enqueueAnnouncementNotifications(tx: Tx, resourceId: string, circleId: string, posterId: number): Promise<number> {
  const recipients = await channelsFor(tx, and(inCircle(circleId), ne(members.id, posterId)));
  if (recipients.length === 0) return 0;
  await tx.insert(announcementNotifications).values(recipients.map((r) => ({ resourceId, ...r }))).onConflictDoNothing();
  return membersIn(recipients);
}

export type AnnouncementKey = { resourceId: string; memberId: number; channel: NotificationChannel };

export type PendingAnnouncementNotification = Omit<AnnouncementEmailData, "url"> &
  AnnouncementKey & {
    circleId: string;
    // null if they've since removed their address: an email row is then dropped
    email: string | null;
    // likewise their number, for a text
    phone: string | null;
  };

// claimEventNotifications' counterpart for announcements: the same leasing, so
// concurrent drains get different rows. Rendered from the announcement as it
// stands now, so an edit made before it goes out is what's sent.
export async function claimAnnouncementNotifications(limit: number, channel: NotificationChannel): Promise<PendingAnnouncementNotification[]> {
  const poster = alias(members, "poster");
  return db.transaction(async (tx) => {
    const due = await tx
      .select({ resourceId: announcementNotifications.resourceId, memberId: announcementNotifications.memberId })
      .from(announcementNotifications)
      .where(
        and(
          eq(announcementNotifications.channel, channel),
          isNull(announcementNotifications.sentAt),
          lt(announcementNotifications.attempts, MAX_ATTEMPTS),
          or(isNull(announcementNotifications.lastAttemptAt), lt(announcementNotifications.lastAttemptAt, sql`now() - ${RETRY_AFTER}`))
        )
      )
      .orderBy(announcementNotifications.createdAt)
      .limit(limit)
      .for("update", { skipLocked: true });
    if (due.length === 0) return [];
    const isDue = and(
      eq(announcementNotifications.channel, channel),
      or(...due.map((d) => and(eq(announcementNotifications.resourceId, d.resourceId), eq(announcementNotifications.memberId, d.memberId))))
    );
    await tx
      .update(announcementNotifications)
      .set({ attempts: sql`${announcementNotifications.attempts} + 1`, lastAttemptAt: sql`now()` })
      .where(isDue);
    const rows = await tx
      .select({
        resourceId: circleResources.id,
        circleId: circleResources.circleId,
        memberId: members.id,
        channel: announcementNotifications.channel,
        email: emailIfWanted,
        phone: phoneIfWanted,
        title: circleResources.title,
        message: circleResources.message,
        createdAt: circleResources.createdAt,
        circleName: circles.name,
        posterName: poster.name,
      })
      .from(announcementNotifications)
      .innerJoin(circleResources, eq(circleResources.id, announcementNotifications.resourceId))
      .innerJoin(circles, eq(circles.id, circleResources.circleId))
      .innerJoin(members, eq(members.id, announcementNotifications.memberId))
      .leftJoin(poster, eq(poster.id, circleResources.createdBy))
      .where(isDue);
    // an item edited into a link since has no message left to send (the row
    // stays claimed until it runs out of attempts)
    return rows.flatMap(({ message, posterName, ...r }) => (message !== null ? [{ ...r, message, ...(posterName ? { posterName } : {}) }] : []));
  });
}

const isAnnouncementRow = (n: AnnouncementKey) =>
  and(eq(announcementNotifications.resourceId, n.resourceId), eq(announcementNotifications.memberId, n.memberId), eq(announcementNotifications.channel, n.channel));

export async function markAnnouncementSent(n: AnnouncementKey): Promise<void> {
  await db.update(announcementNotifications).set({ sentAt: sql`now()`, lastError: null }).where(isAnnouncementRow(n));
}

export async function markAnnouncementFailed(n: AnnouncementKey, error: string): Promise<void> {
  await db.update(announcementNotifications).set({ lastError: error.slice(0, 500) }).where(isAnnouncementRow(n));
}

/* Tell `memberIds` about a proposal (lib/db/proposals.ts): that it's open for
   their answer, that someone objected, or that it passed. Always on its own,
   straight away — a proposal has a deadline, so a digest line a day later
   would eat into it. Runs in the transaction that earns it. */
export async function enqueueProposalNotifications(tx: Tx, proposalId: string, kind: ProposalNoticeKind, memberIds: number[]): Promise<number> {
  if (memberIds.length === 0) return 0;
  const recipients = await channelsFor(tx, inArray(members.id, memberIds));
  if (recipients.length === 0) return 0;
  await tx
    .insert(proposalNotifications)
    .values(recipients.map((r) => ({ proposalId, ...r, kind })))
    .onConflictDoNothing();
  return membersIn(recipients);
}

export type ProposalKey = { proposalId: string; memberId: number; notice: ProposalNoticeKind; channel: NotificationChannel };

export type PendingProposalNotification = Omit<ProposalEmailData, "url"> &
  ProposalKey & {
    // null if they've since removed their address or turned email off
    email: string | null;
    // likewise their number, for a text
    phone: string | null;
  };

// claimEventNotifications' counterpart for proposals: the same leasing, and
// rendered from the proposal as it stands when it's sent
export async function claimProposalNotifications(limit: number, channel: NotificationChannel): Promise<PendingProposalNotification[]> {
  const proposer = alias(members, "proposer");
  const objector = alias(members, "objector");
  return db.transaction(async (tx) => {
    const due = await tx
      .select({ proposalId: proposalNotifications.proposalId, memberId: proposalNotifications.memberId, kind: proposalNotifications.kind })
      .from(proposalNotifications)
      .where(
        and(
          eq(proposalNotifications.channel, channel),
          isNull(proposalNotifications.sentAt),
          lt(proposalNotifications.attempts, MAX_ATTEMPTS),
          or(isNull(proposalNotifications.lastAttemptAt), lt(proposalNotifications.lastAttemptAt, sql`now() - ${RETRY_AFTER}`))
        )
      )
      .orderBy(proposalNotifications.createdAt)
      .limit(limit)
      .for("update", { skipLocked: true });
    if (due.length === 0) return [];
    const isDue = and(
      eq(proposalNotifications.channel, channel),
      or(...due.map((d) => and(eq(proposalNotifications.proposalId, d.proposalId), eq(proposalNotifications.memberId, d.memberId), eq(proposalNotifications.kind, d.kind))))
    );
    await tx.update(proposalNotifications).set({ attempts: sql`${proposalNotifications.attempts} + 1`, lastAttemptAt: sql`now()` }).where(isDue);
    const rows = await tx
      .select({
        proposalId: proposalNotifications.proposalId,
        memberId: members.id,
        notice: proposalNotifications.kind,
        channel: proposalNotifications.channel,
        email: emailIfWanted,
        phone: phoneIfWanted,
        circleName: circles.name,
        changes: circleProposals.changes,
        lines: circleProposals.lines,
        closesAt: circleProposals.closesAt,
        proposerName: proposer.name,
        objectorName: objector.name,
        reason: proposalResponses.reason,
      })
      .from(proposalNotifications)
      .innerJoin(circleProposals, eq(circleProposals.id, proposalNotifications.proposalId))
      .innerJoin(circles, eq(circles.id, circleProposals.circleId))
      .innerJoin(members, eq(members.id, proposalNotifications.memberId))
      .innerJoin(proposer, eq(proposer.id, circleProposals.proposerId))
      // the objection, for an "objected" notice (one closes it, so there's one)
      .leftJoin(proposalResponses, and(eq(proposalResponses.proposalId, circleProposals.id), eq(proposalResponses.response, "object")))
      .leftJoin(objector, eq(objector.id, proposalResponses.memberId))
      .where(isDue);
    return rows.map(({ objectorName, reason, ...r }) => ({
      ...r,
      ...(objectorName ? { objectorName } : {}),
      ...(reason ? { reason } : {}),
    }));
  });
}

const isProposalRow = (n: ProposalKey) =>
  and(
    eq(proposalNotifications.proposalId, n.proposalId),
    eq(proposalNotifications.memberId, n.memberId),
    eq(proposalNotifications.kind, n.notice),
    eq(proposalNotifications.channel, n.channel)
  );

export async function markProposalSent(n: ProposalKey): Promise<void> {
  await db.update(proposalNotifications).set({ sentAt: sql`now()`, lastError: null }).where(isProposalRow(n));
}

export async function markProposalFailed(n: ProposalKey, error: string): Promise<void> {
  await db.update(proposalNotifications).set({ lastError: error.slice(0, 500) }).where(isProposalRow(n));
}
