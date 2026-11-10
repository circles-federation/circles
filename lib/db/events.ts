import { randomUUID } from "node:crypto";
import { and, asc, eq, gte, inArray, isNotNull, isNull, lt, lte, or, sql, type Column, type SQL } from "drizzle-orm";
import { db, type Tx } from "./client";
import { UserFacingError } from "./errors";
import { circleMembers, circleRoles, circles, eventAgendaItems, eventGuestRsvps, eventNotifications, eventRsvps, eventSeries, eventVotes, events, roleMembers, roles } from "./schema";
import { groupBy } from "./util";
import { confirmedGuestCount, enqueueGuestCancellations, enqueueGuestUpdates } from "./guest-notifications";
import { openEventProposal, withdrawEventProposal } from "./proposals";
import { enqueueCancellationNotifications, enqueueEventNotifications, enqueueProposalApprovalNotifications, enqueueUpdateNotifications, enqueueSlotWarnings, wallClock, withdrawEventNotifications, withdrawReminders, withdrawSlotWarnings } from "./notifications";
import { circleCanHoldMeetings, hostCanShowTo, isGroup } from "@/lib/circles.util";
import { eventStartsAt, hasEnded, DEFAULT_REMINDERS, normalizeReminders, remindersWithin, roleKey, validateEventDraft, type EventDetails, type EventDraft, type RoleDraft, type SeriesScope } from "@/lib/events.util";
import { isPastEvent } from "@/lib/format.util";
import { REPEAT_HORIZON_DAYS, addDays, datesBetween, localDay } from "@/lib/recurrence.util";
import { AUTO_CANCEL_MS, SLOT_WARNING_MS } from "@/lib/roles.util";
import type { AgendaItem, Event, EventRepeat, Role } from "@/lib/types";

// starts within the hour (or has started): too close to be cancelled
// automatically for a short slot (see checkUnfilledSlots)
function startsWithinTheHour(e: Pick<Event, "date" | "start">): boolean {
  return eventStartsAt(e).getTime() - Date.now() <= SLOT_WARNING_MS;
}

/* An event belongs to one circle, and that circle is its audience: only the
   circle's members (and, for the city root, everyone) can see it or RSVP to
   it. An event may instead be hosted by a circle, which need not be the one
   it's shown to: it starts as a proposal that only the host circle's members
   can see, and goes live for its audience once they consent to it — as a
   meeting does for its own circle, unless one of the circle's role-holders
   schedules it (lib/db/proposals.ts). This file is where all of that is enforced — not the UI, and
   not the caller. Reads only return events the given member may see; every write
   takes the acting member's id (lib/db/actions.ts passes the signed-in one)
   and checks it, and computes any rsvp/vote/slot arrays itself rather than
   trusting a client-supplied one. Kept free of any session/request access so
   it can be exercised directly.

   A repeating event is a series (event_series) whose dates are each an
   ordinary event here, made a few weeks ahead — so everything above applies
   to each date on its own. What's series-wide: creating it (the circle is
   told once, about the first date), a circle-hosted series' approval (the
   host circle votes once, on the first date, and approving it adds the
   rest), and an edit or cancellation its organizer applies to "this and
   later dates". */

export class EventError extends UserFacingError {}

type EventRow = typeof events.$inferSelect;
type SeriesRow = typeof eventSeries.$inferSelect;

// Postgres always formats a `time` column as "HH:MM:SS" on read, regardless
// of input precision — lib/format.util.ts's fmtTime/eventDateTime assume the
// app's own "HH:MM" shape, so every read normalizes it back to that
function toClockTime(t: string): string {
  return t.slice(0, 5);
}

function toRepeat(s: SeriesRow): EventRepeat {
  return { seriesId: s.id, frequency: s.frequency, startsOn: s.startsOn, ...(s.until !== null ? { until: s.until } : {}) };
}

function toEvent(row: EventRow, rsvps: number[], votes: number[] | undefined, eventRoles: Role[] | undefined, series: SeriesRow | undefined, agenda: AgendaItem[] | undefined, guests: string[] | undefined): Event {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind ?? undefined,
    circleId: row.circleId,
    ...(row.hostCircleId !== null ? { hostCircleId: row.hostCircleId } : {}),
    // a meeting or circle-hosted event its circle hasn't consented to yet
    ...(row.approvedAt === null ? { proposed: true } : {}),
    ...(row.approvedByRole !== null ? { approvedByRole: row.approvedByRole } : {}),
    ...(row.cancelledAt !== null ? { cancelled: true } : {}),
    ...(row.cancelledAutomatically ? { cancelledAutomatically: true as const } : {}),
    ...(!row.autoCancel ? { noAutoCancel: true as const } : {}),
    organizerId: row.organizerId,
    date: row.date,
    start: toClockTime(row.start),
    end: toClockTime(row.end),
    location: row.location,
    description: row.description,
    reminders: row.reminders,
    rsvps,
    ...(guests && guests.length > 0 ? { guests } : {}),
    roles: eventRoles,
    votes,
    ...(agenda ? { agenda } : {}),
    ...(series ? { repeat: toRepeat(series) } : {}),
  };
}

async function attachRelations(rows: EventRow[]): Promise<Event[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const seriesIds = [...new Set(rows.flatMap((r) => (r.seriesId !== null ? [r.seriesId] : [])))];
  const meetingIds = rows.filter((r) => r.kind === "meeting").map((r) => r.id);
  const [rsvpRows, guestRows, voteRows, roleRows, seriesRows, agendaRows] = await Promise.all([
    db.select().from(eventRsvps).where(inArray(eventRsvps.eventId, ids)),
    // first names only, in the order they confirmed: nothing that identifies a guest further
    db
      .select({ eventId: eventGuestRsvps.eventId, name: eventGuestRsvps.name })
      .from(eventGuestRsvps)
      .where(and(inArray(eventGuestRsvps.eventId, ids), isNotNull(eventGuestRsvps.confirmedAt)))
      .orderBy(asc(eventGuestRsvps.confirmedAt)),
    db.select().from(eventVotes).where(inArray(eventVotes.eventId, ids)),
    db.select().from(roles).where(inArray(roles.eventId, ids)),
    seriesIds.length > 0 ? db.select().from(eventSeries).where(inArray(eventSeries.id, seriesIds)) : Promise.resolve([]),
    meetingIds.length > 0
      ? db.select().from(eventAgendaItems).where(inArray(eventAgendaItems.eventId, meetingIds)).orderBy(asc(eventAgendaItems.position))
      : Promise.resolve([]),
  ]);
  const agendaByEvent = groupBy(agendaRows, (a) => a.eventId, (a): AgendaItem => ({
    category: a.category,
    title: a.title,
    ...(a.details !== null ? { details: a.details } : {}),
  }));
  const seriesById = new Map(seriesRows.map((s) => [s.id, s]));
  const roleMemberRows = roleRows.length > 0 ? await db.select().from(roleMembers).where(inArray(roleMembers.roleId, roleRows.map((r) => r.id))) : [];
  const rsvpsByEvent = groupBy(rsvpRows, (r) => r.eventId, (r) => r.memberId);
  const guestsByEvent = groupBy(guestRows, (r) => r.eventId, (r) => r.name.trim().split(/\s+/)[0] ?? r.name);
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
      rolesByEvent.get(row.id),
      row.seriesId !== null ? seriesById.get(row.seriesId) : undefined,
      // every meeting has an agenda, even an empty one
      row.kind === "meeting" ? agendaByEvent.get(row.id) || [] : undefined,
      guestsByEvent.get(row.id)
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
  // undecided, only the circle deciding it sees it: the host circle, or a
  // meeting's own circle
  if (row.approvedAt === null) return v.own.includes(decidedBy(row));
  return hosts || v.audience.includes(row.circleId);
}

// the circle whose members consent to it: its host circle, or for a meeting
// (never circle-hosted) its own circle
function decidedBy(row: Pick<EventRow, "hostCircleId" | "circleId">): string {
  return row.hostCircleId ?? row.circleId;
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
        and(isNull(events.approvedAt), or(anyOf(events.hostCircleId, v.own), and(isNull(events.hostCircleId), anyOf(events.circleId, v.own))))
      )
    );
  return attachRelations(rows);
}

// one event, as the app shapes it, whoever's asking — for the DAL's own use
// (lib/db/proposals.ts), never for a member's request (that's getVisibleEvent)
export async function getEvent(id: string, tx: Tx | typeof db = db): Promise<Event | null> {
  const [row] = await tx.select().from(events).where(eq(events.id, id));
  const [full] = row ? await attachRelations([row]) : [];
  return full ?? null;
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

// one event, if the member may see it — for reads outside AppState, like the
// calendar file (app/api/events/[id]/calendar); null for a missing or hidden one
export async function getVisibleEvent(memberId: number, id: string): Promise<Event | null> {
  const [row] = await db.select().from(events).where(eq(events.id, id));
  if (!row || !canSee(row, await viewerCircles(memberId))) return null;
  const [full] = await attachRelations([row]);
  return full ?? null;
}

// RSVPs and slot signups open once a circle-hosted event is approved
function assertLive(row: EventRow) {
  if (row.approvedAt === null) throw new EventError("This is still waiting on its circle's consent.");
}

// a cancelled event is closed to everything: RSVPs, votes, signups and edits
function assertNotCancelled(row: EventRow) {
  if (row.cancelledAt !== null) throw new EventError("This event has been cancelled.");
}

/* Who may edit or cancel an event: its organizer, and for one a circle hosts,
   any member of that circle — the circle holds it, so the circle looks after
   it. One a person hosts is theirs alone. */
async function assertCanManage(row: EventRow, memberId: number, verb: "edit" | "cancel"): Promise<void> {
  if (row.organizerId === memberId) return;
  const circleId = row.hostCircleId ?? (row.kind === "meeting" ? row.circleId : null);
  if (circleId !== null) {
    const [membership] = await db
      .select({ id: circleMembers.memberId })
      .from(circleMembers)
      .where(and(eq(circleMembers.circleId, circleId), eq(circleMembers.memberId, memberId)));
    if (membership) return;
  }
  throw new EventError(circleId !== null ? `Only members of the circle holding this can ${verb} it.` : `Only the person hosting this event can ${verb} it.`);
}

// whether this member manages the event (assertCanManage's rule, for one they
// can see), for what only a manager may do besides editing and cancelling
export async function memberManagesEvent(memberId: number, id: string): Promise<boolean> {
  const [row] = await db.select().from(events).where(eq(events.id, id));
  if (!row || !canSee(row, await viewerCircles(memberId))) return false;
  return assertCanManage(row, memberId, "edit").then(
    () => true,
    () => false
  );
}

// a meeting or circle-hosted event its circle hasn't consented to yet (see
// lib/db/proposals.ts) — one a person hosts is approved from the start
function awaitingConsent(row: EventRow): boolean {
  return row.approvedAt === null;
}

// what's over is a record: no more RSVPs, votes or signups, coming or going
function assertNotOver(row: EventRow) {
  if (hasEnded(row)) throw new EventError("This event is over.");
}

async function assertCanPost(v: Viewer, circleId: string): Promise<{ isRoot: boolean; canHoldMeetings: boolean }> {
  const [circle] = await db.select({ parentId: circles.parentId, type: circles.type, features: circles.features }).from(circles).where(eq(circles.id, circleId));
  if (!circle) throw new EventError("That circle doesn't exist.");
  if (!v.audience.includes(circleId)) throw new EventError("You can only post to circles you belong to.");
  return { isRoot: circle.parentId === null, canHoldMeetings: circleCanHoldMeetings(circle) };
}

// a circle can host only if it has members of its own to decide (not the city,
// whose roster is implicit), the proposer is one of them, and it's the circle
// the event is shown to or one inside it — only ever itself, for a private
// group (hostCanShowTo); returns how many members it has, and whether it's a
// group, whose events are proposed for consent (see lib/db/proposals.ts)
async function assertCanHost(v: Viewer, circleId: string, audienceCircleId: string): Promise<{ size: number; group: boolean }> {
  const rows = await db.select({ id: circles.id, parentId: circles.parentId, type: circles.type }).from(circles);
  const circle = rows.find((c) => c.id === circleId);
  if (!circle) throw new EventError("That circle doesn't exist.");
  if (circle.parentId === null) throw new EventError("The whole city can't host an event — pick one of your circles.");
  if (!v.own.includes(circleId)) throw new EventError("You can only host on behalf of a circle you belong to.");
  const parents = new Map(rows.map((c) => [c.id, c.parentId]));
  if (!hostCanShowTo(circle, audienceCircleId, (id) => parents.get(id))) {
    throw new EventError(isGroup(circle) ? "A group's events are shown only to the group." : "A circle can only host an event shown to itself or to a circle it's part of.");
  }
  const members = await db.select({ id: circleMembers.memberId }).from(circleMembers).where(eq(circleMembers.circleId, circleId));
  return { size: members.length, group: isGroup(circle) };
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

// a meeting's agenda as it's stored: trimmed, blank details dropped
function cleanAgenda(items: AgendaItem[] = []): AgendaItem[] {
  return items.map((a) => ({ category: a.category, title: a.title.trim(), ...(a.details?.trim() ? { details: a.details.trim() } : {}) }));
}

// replace a meeting's agenda as a whole, in the given order
async function writeAgenda(tx: Tx, eventId: string, items: AgendaItem[]) {
  await tx.delete(eventAgendaItems).where(eq(eventAgendaItems.eventId, eventId));
  if (items.length === 0) return;
  await tx.insert(eventAgendaItems).values(
    items.map((a, position) => ({ eventId, position, category: a.category, title: a.title, details: a.details ?? null }))
  );
}

/* The raw, trusted insert — no authorization, no validation. Only for callers
   that already hold a complete, vetted Event: createEvent below, and the seed
   script (whose fixtures carry their own ids, rsvps, and votes). */
export async function insertEvent(event: Event, options: { notifyMembers?: boolean } = {}): Promise<Event> {
  await db.transaction((tx) => writeEvent(tx, event, options));
  return event;
}

async function writeEvent(tx: Tx, event: Event, options: { notifyMembers?: boolean } = {}) {
  await tx.insert(events).values({
    id: event.id,
    title: event.title,
    kind: event.kind ?? null,
    circleId: event.circleId,
    hostCircleId: event.hostCircleId ?? null,
    approvedAt: event.proposed ? null : new Date(),
    approvedByRole: event.approvedByRole ?? null,
    organizerId: event.organizerId,
    date: event.date,
    start: event.start,
    end: event.end,
    location: event.location,
    description: event.description,
    reminders: event.reminders ?? DEFAULT_REMINDERS,
    // created this close, its people have only just heard of it
    remindedHours: remindersWithin(event),
    autoCancel: !startsWithinTheHour(event),
    seriesId: event.repeat?.seriesId ?? null,
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
  if (event.agenda && event.agenda.length > 0) await writeAgenda(tx, event.id, event.agenda);
  if (options.notifyMembers) await enqueueEventNotifications(tx, event);
}

/* Create an event as `memberId`. The server decides the id, the organizer
   (always the caller), whether it starts as a proposal, and who starts out
   attending — whatever the client might have said about those is not an
   input. A circle-hosted event, and a meeting, is proposed to its circle for
   consent (createConsentEvent; one in a circle of one is decided at once),
   except a meeting created by someone holding a role in its circle, which is
   scheduled outright (`approvedByRole`).

   A repeating one also creates its series, and with it the dates due in the
   next few weeks (once it's live — a proposal's wait for its approval). Only
   the first date notifies anyone; the email says how it repeats. Returns
   every date created, soonest (the one asked for) first. */
export async function createEvent(memberId: number, draft: EventDraft): Promise<{ events: Event[]; proposalId?: string }> {
  const problem = validateEventDraft(draft, { creating: true });
  if (problem) throw new EventError(problem);
  const viewer = await viewerCircles(memberId);
  const { isRoot, canHoldMeetings } = await assertCanPost(viewer, draft.circleId);
  const host = draft.hostCircleId ? await assertCanHost(viewer, draft.hostCircleId, draft.circleId) : null;
  if (draft.kind === "meeting" && isRoot) throw new EventError("A meeting needs a circle with its own members — pick a neighborhood or one of your circles.");
  if (draft.kind === "meeting" && !canHoldMeetings) throw new EventError("This circle hasn't turned on meetings — post an ordinary event to it instead.");
  // a meeting held by anyone holding a role in its circle is scheduled
  // outright; every other meeting, and every event a circle hosts, is
  // proposed to that circle for its members' consent (lib/db/proposals.ts)
  const approvedByRole = draft.kind === "meeting" ? await roleHeldIn(memberId, draft.circleId) : null;
  const consent = !!host || (draft.kind === "meeting" && !approvedByRole);
  const template: Template = {
    title: draft.title.trim(),
    kind: draft.kind,
    circleId: draft.circleId,
    hostCircleId: draft.hostCircleId ?? null,
    organizerId: memberId,
    approvedByRole,
    start: draft.start,
    end: draft.end,
    location: draft.location.trim(),
    // a meeting has its agenda instead
    description: draft.kind === "meeting" ? "" : draft.description.trim(),
    roles: draft.roles ?? [],
    reminders: normalizeReminders(draft.reminders ?? DEFAULT_REMINDERS) ?? DEFAULT_REMINDERS,
  };
  // a consent proposal always starts open, even in a circle of one, which
  // openEventProposal then passes at once
  const first: Event = {
    ...newDate(template, draft.date, { opening: true, proposed: consent }),
    ...(draft.kind === "meeting" ? { agenda: cleanAgenda(draft.agenda) } : {}),
    // decided by consent, or not at all: no one votes
    votes: [],
  };
  const repeat = draft.repeat;
  if (consent) return createConsentEvent(memberId, template, first, repeat);
  if (!repeat) return { events: [await insertEvent(first, { notifyMembers: true })] };
  const seriesId = randomUUID();
  await db.transaction(async (tx) => {
    const [series] = await tx
      .insert(eventSeries)
      .values({
        ...template,
        id: seriesId,
        frequency: repeat.frequency,
        startsOn: draft.date,
        until: repeat.until ?? null,
        generatedThrough: draft.date,
        // a person's own series: live from the start (a circle's is decided by consent, below)
        approvedAt: new Date(),
      })
      .returning();
    if (!series) throw new EventError("Couldn't save that — try again.");
    await writeEvent(tx, { ...first, repeat: toRepeat(series) }, { notifyMembers: true });
    await extendSeries(tx, series);
  });
  return { events: await loadSeries(seriesId) };
}

/* A meeting or a circle-hosted event: saved unapproved, and proposed to the
   circle that decides it for its members' consent in the same transaction, so
   neither exists without the other. The proposal's notices tell the circle (not the event's own
   "proposed" one); a series waits, like any circle-hosted one, for the
   decision on its first date. */
async function createConsentEvent(memberId: number, template: Template, first: Event, repeat: EventDraft["repeat"]): Promise<{ events: Event[]; proposalId: string }> {
  const seriesId = repeat ? randomUUID() : null;
  const proposalId = await db.transaction(async (tx) => {
    let event = first;
    if (repeat && seriesId) {
      const [series] = await tx
        .insert(eventSeries)
        .values({ ...template, id: seriesId, frequency: repeat.frequency, startsOn: first.date, until: repeat.until ?? null, generatedThrough: first.date, approvedAt: null })
        .returning();
      if (!series) throw new EventError("Couldn't save that — try again.");
      event = { ...first, repeat: toRepeat(series) };
    }
    await writeEvent(tx, event);
    return openEventProposal(tx, memberId, event);
  });
  return { events: seriesId ? await loadSeries(seriesId) : [await loadFull(first.id)], proposalId };
}

/* A meeting's or circle-hosted event's approval, when its consent proposal
   passes (lib/db/proposals.ts): it opens to its circle, the circle is told
   (but `actorId`, whose answer passed it), and for the first date of a series
   the series is approved and its later dates added, already approved and
   silent. The caller holds the proposal's lock. */
export async function approveHostedEvent(tx: Tx, id: string, actorId: number | null): Promise<void> {
  const [row] = await tx.select().from(events).where(eq(events.id, id));
  if (!row || row.approvedAt !== null || row.cancelledAt !== null) return;
  await tx.update(events).set({ approvedAt: new Date() }).where(eq(events.id, id));
  // approving is what makes it visible to its circle, so tell them — in this
  // same transaction, so an approval can't happen without its emails
  await enqueueProposalApprovalNotifications(tx, row, actorId);
  if (row.seriesId !== null) {
    const [series] = await tx
      .update(eventSeries)
      .set({ approvedAt: new Date() })
      .where(and(eq(eventSeries.id, row.seriesId), isNull(eventSeries.approvedAt)))
      .returning();
    if (series) await extendSeries(tx, series);
  }
}

// a role a member holds in a circle, if any (built-in or the circle's own, the
// first in its order) — the server's own read of what approvingRole
// (lib/circle-roles.util.ts) checks in the form. Posting a meeting already
// requires membership, so a holder here is a member.
async function roleHeldIn(memberId: number, circleId: string): Promise<string | null> {
  const [held] = await db
    .select({ label: circleRoles.label })
    .from(circleRoles)
    .where(and(eq(circleRoles.circleId, circleId), eq(circleRoles.memberId, memberId)))
    .orderBy(asc(circleRoles.position))
    .limit(1);
  return held?.label ?? null;
}

// what an event's fixed facts are made from — a draft being created, or a
// series' saved template for its later dates
type Template = Pick<SeriesRow, "title" | "kind" | "circleId" | "hostCircleId" | "organizerId" | "approvedByRole" | "start" | "end" | "location" | "description" | "roles" | "reminders">;

/* A date's starting state. The organizer attends their own event — except a
   slotted one, where people sign up for slots instead, and a circle-hosted
   one, whose proposer is marked going by proposing it, along with everyone
   who consents (rsvpConsenters in lib/db/proposals.ts), so a series' later
   dates start with no one — and a meeting opens with
   their vote, as does a proposal (`opening`: the date the host circle votes
   on; a series' later dates are approved already). */
function newDate(t: Template, date: string, { opening, proposed }: { opening: boolean; proposed: boolean }): Event {
  const isMeeting = t.kind === "meeting";
  const hosted = t.hostCircleId !== null;
  const eventRoles = buildRoles(t.roles);
  const attends = !hosted && (isMeeting || eventRoles.length === 0);
  return {
    id: randomUUID(),
    title: t.title,
    kind: t.kind ?? undefined,
    circleId: t.circleId,
    ...(t.hostCircleId !== null ? { hostCircleId: t.hostCircleId } : {}),
    ...(proposed ? { proposed: true } : {}),
    ...(t.approvedByRole !== null ? { approvedByRole: t.approvedByRole } : {}),
    organizerId: t.organizerId,
    date,
    start: toClockTime(t.start),
    end: toClockTime(t.end),
    location: t.location,
    description: t.description,
    reminders: t.reminders,
    rsvps: attends ? [t.organizerId] : [],
    // approved by its role holder, there's no vote to open with
    ...(isMeeting || (hosted && opening) ? { votes: t.approvedByRole !== null ? [] : [t.organizerId] } : {}),
    ...(eventRoles.length > 0 ? { roles: eventRoles } : {}),
  };
}

/* Add a series' dates up to REPEAT_HORIZON_DAYS from today — none if it's a
   proposal still waiting on its vote, and none already past. Runs in the
   caller's transaction, with the series row locked or just created. New
   dates tell no one: the circle heard about the series when it began. */
async function extendSeries(tx: Tx, s: SeriesRow, today: string = localDay()): Promise<void> {
  if (s.approvedAt === null) return;
  const through = addDays(today, REPEAT_HORIZON_DAYS[s.frequency]);
  if (through <= s.generatedThrough) return;
  const yesterday = addDays(today, -1);
  const after = s.generatedThrough > yesterday ? s.generatedThrough : yesterday;
  for (const date of datesBetween(s.frequency, s.startsOn, after, through, s.until)) {
    await writeEvent(tx, { ...newDate(s, date, { opening: false, proposed: false }), repeat: toRepeat(s) });
  }
  await tx.update(eventSeries).set({ generatedThrough: through }).where(eq(eventSeries.id, s.id));
}

/* Top up every live series with the dates now within its horizon — run
   periodically by lib/series.ts, since a series' next date comes into range
   just by time passing. Each series is locked while it's extended, so two
   servers (or a create landing at the same moment) can't add the same date
   twice. Returns how many series were extended. */
export async function extendEventSeries(now: Date = new Date()): Promise<number> {
  const today = localDay(now);
  const live = await db
    .select({ id: eventSeries.id, frequency: eventSeries.frequency, generatedThrough: eventSeries.generatedThrough })
    .from(eventSeries)
    .where(and(isNotNull(eventSeries.approvedAt), or(isNull(eventSeries.until), lt(eventSeries.generatedThrough, eventSeries.until))));
  const due = live.filter((s) => s.generatedThrough < addDays(today, REPEAT_HORIZON_DAYS[s.frequency]));
  for (const { id } of due) {
    await db.transaction(async (tx) => {
      const [s] = await tx.select().from(eventSeries).where(eq(eventSeries.id, id)).for("update");
      if (s) await extendSeries(tx, s, today);
    });
  }
  return due.length;
}

// every date of a series still in the database, soonest first
async function loadSeries(seriesId: string): Promise<Event[]> {
  return attachRelations(await db.select().from(events).where(eq(events.seriesId, seriesId)).orderBy(asc(events.date)));
}

/* Edit an event's own details — organizer only. Deliberately can't change its
   circle or host circle (that would silently change who can see or vote on
   it), kind, organizer, or the rsvps/votes, which have their own actions.

   On a date of a repeating event, `scope` says whether this is for just that
   date or for it and every later one — which also changes the template the
   dates still to come are made from. The day itself only moves one date at a
   time. A circle-hosted series still waiting on its vote has just its first
   date, which is the series so far, so an edit to it is always to both (the
   day included). Returns every event it changed, the one asked for first. */
export async function updateEventDetails(memberId: number, id: string, details: EventDetails, scope: SeriesScope = "one"): Promise<Event[]> {
  const row = await loadVisible(memberId, id);
  assertNotCancelled(row);
  await assertCanManage(row, memberId, "edit");
  // what's proposed is what's consented to, so it can't change while it's asked
  if (await awaitingConsent(row)) throw new EventError("This event is waiting on its group's consent, so it can't be changed until that's decided. Cancel it and propose it again to change it.");
  // what happened is a record now, as it is for cancelling (see cancelEvent)
  if (isPastEvent(row)) throw new EventError("This event has already happened, so it can't be edited.");
  const kind = row.kind ?? "ordinary";
  const problem = validateEventDraft({ ...details, kind, circleId: row.circleId, ...(row.hostCircleId ? { hostCircleId: row.hostCircleId } : {}) });
  if (problem) throw new EventError(problem);
  const seriesId = row.seriesId;
  const fields = {
    title: details.title.trim(),
    start: details.start,
    end: details.end,
    location: details.location.trim(),
    description: kind === "meeting" ? "" : details.description.trim(),
    reminders: normalizeReminders(details.reminders) ?? DEFAULT_REMINDERS,
  };
  const targets = await db.transaction(async (tx) => {
    // the event before its series, the order approval locks them in
    await tx.select({ id: events.id }).from(events).where(eq(events.id, id)).for("update");
    const [series] = seriesId !== null ? await tx.select().from(eventSeries).where(eq(eventSeries.id, seriesId)).for("update") : [];
    const pending = !!series && series.approvedAt === null;
    let ids = [id];
    if (series && (scope === "upcoming" || pending)) {
      if (!pending && details.date !== row.date) throw new EventError("Move one date at a time — save the new day for this date only.");
      if (pending && series.until !== null && details.date >= series.until) throw new EventError("The first date has to be before the last one.");
      await tx
        .update(eventSeries)
        .set({ ...fields, roles: details.roles, ...(pending ? { startsOn: details.date, generatedThrough: details.date } : {}) })
        .where(eq(eventSeries.id, series.id));
      if (!pending) {
        const later = await tx
          .select({ id: events.id })
          .from(events)
          .where(and(eq(events.seriesId, series.id), gte(events.date, row.date), isNull(events.cancelledAt)));
        ids = [id, ...later.map((e) => e.id).filter((e) => e !== id)];
      }
    }
    const existing = await attachRelations(await tx.select().from(events).where(inArray(events.id, ids)));
    const andLater = !!series && scope === "upcoming" && !pending;
    // each person going is told once, about the soonest date they're going to
    // (ids starts with this date, and the rest are later)
    const told = new Set<number>();
    for (const target of ids) {
      const before = existing.find((e) => e.id === target);
      const date = target === id ? details.date : before?.date;
      // a new date, time or place is news to whoever's going; other edits
      // aren't. Read before the slots are rewritten, so someone in a slot this
      // edit removes still hears.
      if (before && (date !== before.date || fields.start !== before.start || fields.end !== before.end || fields.location !== before.location)) {
        const tell = (await goingTo(tx, target, memberId)).going.filter((m) => !told.has(m));
        tell.forEach((m) => told.add(m));
        const was = { date: before.date, start: before.start, end: before.end, location: before.location };
        await enqueueUpdateNotifications(tx, target, tell, { was, ...(andLater ? { andLater } : {}) });
        await enqueueGuestUpdates(tx, target, { was, ...(andLater ? { andLater } : {}) });
      }
      // a new start time sets the reminder going again: due afresh when it's
      // moved further out, and skipped when it's moved to within a day, since
      // the change email just told everyone
      const rescheduled = !!before && date !== undefined && (date !== before.date || fields.start !== before.start);
      if (rescheduled) {
        await withdrawReminders(tx, target);
        await withdrawSlotWarnings(tx, target);
      }
      // a reminder turned on once its time has come would arrive late, all at
      // once, so it's counted as done
      const lateReminders = !rescheduled && before ? fields.reminders.filter((h) => !(before.reminders ?? []).includes(h) && remindersWithin(before).includes(h)) : [];
      await tx
        .update(events)
        .set({
          ...fields,
          ...(target === id ? { date: details.date } : {}),
          // and the short-slot check starts over for the new time: warned
          // afresh, and not cancelled automatically if it's now within the hour
          ...(rescheduled
            ? {
                remindedHours: remindersWithin({ date, start: fields.start }),
                slotsWarnedAt: null,
                autoCancel: !startsWithinTheHour({ date, start: fields.start }),
              }
            : lateReminders.length > 0
              ? { remindedHours: sql`${events.remindedHours} || ${`{${lateReminders.join(",")}}`}::smallint[]` }
              : {}),
        })
        .where(eq(events.id, target));
      // a slot that keeps its name keeps the people already in it, per date
      await writeRoles(tx, target, buildRoles(details.roles, before?.roles));
      if (kind === "meeting") await writeAgenda(tx, target, cleanAgenda(details.agenda));
    }
    return ids;
  });
  const saved = await attachRelations(await db.select().from(events).where(inArray(events.id, targets)));
  return targets.flatMap((t) => saved.filter((e) => e.id === t));
}

// RSVP to (or leave) a plain event — not a meeting (those attend by voting)
// or a slotted event (those attend by taking a slot)
export async function setRsvp(memberId: number, id: string, going: boolean): Promise<Event> {
  const row = await loadVisible(memberId, id);
  assertNotCancelled(row);
  assertNotOver(row);
  assertLive(row);
  const [slot] = await db.select({ id: roles.id }).from(roles).where(eq(roles.eventId, id)).limit(1);
  if (slot) throw new EventError("This event uses signup roles — take a role instead.");
  if (going) await db.insert(eventRsvps).values({ eventId: id, memberId }).onConflictDoNothing();
  else await db.delete(eventRsvps).where(and(eq(eventRsvps.eventId, id), eq(eventRsvps.memberId, memberId)));
  return loadFull(id);
}

// take a slot (leaving any other one — a person holds one at a time, and a
// slot with a max can be full) or leave the one they hold
export async function toggleRoleSlot(memberId: number, id: string, key: string): Promise<Event> {
  const row = await loadVisible(memberId, id);
  assertNotCancelled(row);
  assertNotOver(row);
  assertLive(row);
  await db.transaction(async (tx) => {
    const eventRoles = await tx.select().from(roles).where(eq(roles.eventId, id));
    const target = eventRoles.find((r) => r.key === key);
    if (!target) throw new EventError("That role doesn't exist.");
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
      if (filled.length >= target.max) throw new EventError("That role is full.");
    }
    if (held.length > 0) {
      await tx.delete(roleMembers).where(and(inArray(roleMembers.roleId, held.map((h) => h.roleId)), eq(roleMembers.memberId, memberId)));
    }
    await tx.insert(roleMembers).values({ roleId: target.id, memberId });
  });
  return loadFull(id);
}

/* Cancel an event, as its organizer. What happens depends on whether anyone
   else is going to it (an RSVP — which a meeting's vote also is — or a slot):
   if so it's marked cancelled, stays visible so they find out, and each of
   them is emailed; if not, there's no one to tell and it's simply deleted.
   A proposal's votes are approvals, not RSVPs, so an unapproved one is
   deleted. Either way it's final, and anything still waiting to be sent about
   it (a "new event" email, a digest line) is withdrawn. Decided under a lock
   on the event, so an RSVP landing at the same moment is counted.

   On a date of a repeating event, `scope: "upcoming"` does that to this date
   and every later one, and ends the series the day before — so no more are
   added. Someone going to several of them gets one email, about the soonest,
   which says the rest are off too. A circle-hosted series still waiting on its
   vote has only this date, so cancelling it always ends the series. Returns
   the ids deleted, and every remaining date of the series (or just this
   event) as it now stands. */
export async function cancelEvent(memberId: number, id: string, scope: SeriesScope = "one"): Promise<{ deletedIds: string[]; events: Event[]; withdrawnProposalId?: string }> {
  const row = await loadVisible(memberId, id);
  await assertCanManage(row, memberId, "cancel");
  assertNotCancelled(row);
  // an event still waiting on its circle's consent was never scheduled, so
  // cancelling it withdraws the proposal and the event simply goes — even
  // once its date has passed, since there's nothing that happened to keep
  if (await awaitingConsent(row)) {
    const withdrawn = await db.transaction(async (tx) => {
      await tx.select({ id: events.id }).from(events).where(eq(events.id, id)).for("update");
      const proposalId = await withdrawEventProposal(tx, id);
      await discardEvent(tx, id);
      return proposalId;
    });
    return { deletedIds: [id], events: [], ...(withdrawn ? { withdrawnProposalId: withdrawn } : {}) };
  }
  if (isPastEvent(row)) throw new EventError("This event has already happened.");
  const seriesId = row.seriesId;
  const deletedIds = await db.transaction(async (tx) => {
    await tx.select({ id: events.id }).from(events).where(eq(events.id, id)).for("update");
    const [series] = seriesId !== null ? await tx.select().from(eventSeries).where(eq(eventSeries.id, seriesId)).for("update") : [];
    if (!series || (scope === "one" && series.approvedAt !== null)) {
      const { deleted, going } = await cancelOne(tx, id, memberId);
      if (!deleted) await enqueueCancellationNotifications(tx, id, going);
      return deleted ? [id] : [];
    }
    const later = await tx
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.seriesId, series.id), gte(events.date, row.date), isNull(events.cancelledAt)))
      .orderBy(asc(events.date));
    const deleted: string[] = [];
    // each person is told once, about the soonest date they were going to
    const told = new Set<number>();
    for (const { id: target } of later) {
      if (target !== id) await tx.select({ id: events.id }).from(events).where(eq(events.id, target)).for("update");
      const result = await cancelOne(tx, target, memberId);
      if (result.deleted) deleted.push(target);
      const tell = result.going.filter((m) => !told.has(m));
      tell.forEach((m) => told.add(m));
      if (!result.deleted) await enqueueCancellationNotifications(tx, target, tell);
    }
    const dayBefore = addDays(row.date, -1);
    await tx
      .update(eventSeries)
      .set({ until: series.until !== null && series.until < dayBefore ? series.until : dayBefore })
      .where(eq(eventSeries.id, series.id));
    return deleted;
  });
  return { deletedIds, events: seriesId !== null ? await loadSeries(seriesId) : deletedIds.includes(id) ? [] : [await loadFull(id)] };
}

/* Everyone going to an event other than its organizer: its RSVPs (a meeting's
   voters among them) and its slot holders — who's told when it's moved or
   cancelled. Also returns its slots' ids, which cancelOne deletes by. */
async function goingTo(tx: Tx, id: string, organizerId: number): Promise<{ going: number[]; roleIds: number[] }> {
  const eventRoles = await tx.select({ id: roles.id }).from(roles).where(eq(roles.eventId, id));
  const roleIds = eventRoles.map((r) => r.id);
  const [rsvpRows, slotRows] = await Promise.all([
    tx.select({ memberId: eventRsvps.memberId }).from(eventRsvps).where(eq(eventRsvps.eventId, id)),
    roleIds.length > 0 ? tx.select({ memberId: roleMembers.memberId }).from(roleMembers).where(inArray(roleMembers.roleId, roleIds)) : Promise.resolve([]),
  ]);
  return { going: [...new Set([...rsvpRows, ...slotRows].map((r) => r.memberId))].filter((m) => m !== organizerId), roleIds };
}

/* Delete an event outright, with everything hanging off it — and its series,
   if it was the only date of a series still waiting on its decision (a
   proposed one's first date is all there is until then). For one no one but its organizer was going to
   (cancelOne), and for a group's proposed event that won't be held (an
   objection, or a withdrawal: lib/db/proposals.ts). Its proposal is kept, its
   event_id cleared by the foreign key. */
export async function discardEvent(tx: Tx, id: string): Promise<void> {
  const [row] = await tx.select({ seriesId: events.seriesId }).from(events).where(eq(events.id, id));
  if (!row) return;
  const roleIds = (await tx.select({ id: roles.id }).from(roles).where(eq(roles.eventId, id))).map((r) => r.id);
  if (roleIds.length > 0) await tx.delete(roleMembers).where(inArray(roleMembers.roleId, roleIds));
  await tx.delete(roles).where(eq(roles.eventId, id));
  await tx.delete(eventVotes).where(eq(eventVotes.eventId, id));
  await tx.delete(eventRsvps).where(eq(eventRsvps.eventId, id));
  await tx.delete(eventNotifications).where(eq(eventNotifications.eventId, id));
  await tx.delete(events).where(eq(events.id, id));
  // only a series still waiting on its decision: a live one goes on adding
  // dates even when the one date it has so far is cancelled
  if (row.seriesId !== null) {
    const [other] = await tx.select({ id: events.id }).from(events).where(eq(events.seriesId, row.seriesId)).limit(1);
    if (!other) await tx.delete(eventSeries).where(and(eq(eventSeries.id, row.seriesId), isNull(eventSeries.approvedAt)));
  }
}

/* cancelEvent's work on one event, whose row the caller has locked: deleted
   if no one but the organizer was going, otherwise marked cancelled — and
   either way anything unsent about it withdrawn. Returns who was going, for
   the caller to decide who's emailed. */
async function cancelOne(tx: Tx, id: string, organizerId: number): Promise<{ deleted: boolean; going: number[] }> {
  const { going } = await goingTo(tx, id, organizerId);
  await withdrawEventNotifications(tx, id);
  // a guest who RSVPed from a share link is someone going too
  if (going.length === 0 && (await confirmedGuestCount(tx, id)) === 0) {
    await discardEvent(tx, id);
    return { deleted: true, going };
  }
  await tx.update(events).set({ cancelledAt: new Date() }).where(eq(events.id, id));
  await enqueueGuestCancellations(tx, id);
  return { deleted: false, going };
}

// an event's start, as a timestamp-without-zone in the community's wall-clock
// time, to set against wallClock(now)
const startsAtSql = sql`(${events.date} + ${events.start})`;
// it has slots at all
const hasSlots = sql`exists (select 1 from ${roles} where ${roles.eventId} = ${events.id})`;
// it has a required slot short of its minimum
const hasShortSlot = sql`exists (select 1 from ${roles} where ${roles.eventId} = ${events.id} and ${roles.min} > (select count(*) from ${roleMembers} where ${roleMembers.roleId} = ${roles.id}))`;

/* An event's host, who's told about a short slot: its organizer, and for a
   circle-hosted one the host circle's role holders (its Leader, Secretary,
   Facilitator and its own roles) if any are assigned, or else every member,
   any of whom might know someone who can cover. Roles keep a big circle from
   messaging everyone; a holder who's since left the circle doesn't count, as
   they read as unassigned everywhere else. */
async function hostOf(tx: Tx, row: { organizerId: number; hostCircleId: string | null }): Promise<number[]> {
  if (row.hostCircleId === null) return [row.organizerId];
  const holders = await tx
    .select({ id: circleRoles.memberId })
    .from(circleRoles)
    .innerJoin(circleMembers, and(eq(circleMembers.circleId, circleRoles.circleId), eq(circleMembers.memberId, circleRoles.memberId)))
    .where(eq(circleRoles.circleId, row.hostCircleId));
  const told = holders.length > 0
    ? holders.flatMap((h) => (h.id !== null ? [h.id] : []))
    : (await tx.select({ id: circleMembers.memberId }).from(circleMembers).where(eq(circleMembers.circleId, row.hostCircleId))).map((r) => r.id);
  return [...new Set([row.organizerId, ...told])];
}

/* Events with a required slot still short as they come up, run by the
   notification poller (lib/notify.ts) every 15 seconds, since this happens
   just by time passing (see lib/roles.util.ts's lifecycle):

   - An hour before the start (SLOT_WARNING_MS), its host is told, once
     (slots_warned_at), so they can find someone to cover it. One created or
     moved to within the hour is told straight away.
   - 15 minutes before (AUTO_CANCEL_MS), if a required slot is still short,
     it's cancelled — for good, like an organizer's cancellation, but marked
     as automatic and never deleted — and everyone going and its host are
     told. That's decided once: one whose slots are filled at that point is
     no longer cancelled automatically, so someone dropping out after it
     doesn't call it off at the last minute (they only bring the warning
     back). Nor is one created or moved to within the hour (auto_cancel).

   Each event is locked while it's decided, so two servers can't both act on
   it. Returns the ids it cancelled. */
export async function checkUnfilledSlots(now: Date = new Date()): Promise<string[]> {
  const nowSql = sql`${wallClock(now)}::timestamp`;
  const warnFrom = sql`${wallClock(new Date(now.getTime() + SLOT_WARNING_MS))}::timestamp`;
  const cancelFrom = sql`${wallClock(new Date(now.getTime() + AUTO_CANCEL_MS))}::timestamp`;
  const upcoming = and(
    isNull(events.cancelledAt),
    isNotNull(events.approvedAt),
    // the dates it can fall on, so the date index narrows this to a day or
    // two before the start time (which no index covers) is compared
    gte(events.date, localDay(now)),
    lte(events.date, localDay(new Date(now.getTime() + SLOT_WARNING_MS))),
    sql`${startsAtSql} > ${nowSql}`
  );

  // past the 15-minute point with every required slot filled: it runs. Only
  // events with slots, since one without has nothing to decide.
  await db
    .update(events)
    .set({ autoCancel: false })
    .where(and(upcoming, eq(events.autoCancel, true), sql`${startsAtSql} <= ${cancelFrom}`, hasSlots, sql`not ${hasShortSlot}`));

  const due = await db
    .select({ id: events.id })
    .from(events)
    .where(and(upcoming, sql`${startsAtSql} <= ${warnFrom}`, hasShortSlot, or(isNull(events.slotsWarnedAt), and(eq(events.autoCancel, true), sql`${startsAtSql} <= ${cancelFrom}`))));

  const cancelled: string[] = [];
  for (const { id } of due) {
    const didCancel = await db.transaction(async (tx) => {
      const [row] = await tx.select().from(events).where(eq(events.id, id)).for("update", { skipLocked: true });
      if (!row || row.cancelledAt !== null || row.approvedAt === null) return false;
      const ms = eventStartsAt({ date: row.date, start: toClockTime(row.start) }).getTime() - now.getTime();
      const short = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(and(eq(roles.eventId, id), sql`${roles.min} > (select count(*) from ${roleMembers} where ${roleMembers.roleId} = ${roles.id})`))
        .limit(1);
      if (ms <= 0 || short.length === 0) return false;
      const hosts = await hostOf(tx, row);
      if (row.autoCancel && ms <= AUTO_CANCEL_MS) {
        const { going } = await goingTo(tx, id, row.organizerId);
        await withdrawEventNotifications(tx, id);
        await tx.update(events).set({ cancelledAt: new Date(), cancelledAutomatically: true }).where(eq(events.id, id));
        await enqueueGuestCancellations(tx, id);
        await enqueueCancellationNotifications(tx, id, [...new Set([...going, ...hosts])]);
        return true;
      }
      if (row.slotsWarnedAt === null) {
        await tx.update(events).set({ slotsWarnedAt: new Date() }).where(eq(events.id, id));
        await enqueueSlotWarnings(tx, id, hosts);
      }
      return false;
    });
    if (didCancel) cancelled.push(id);
  }
  return cancelled;
}
