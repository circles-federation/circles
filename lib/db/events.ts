import { randomUUID } from "node:crypto";
import { and, asc, eq, gte, inArray, isNotNull, isNull, lt, or, sql, type Column, type SQL } from "drizzle-orm";
import { db, type Tx } from "./client";
import { UserFacingError } from "./errors";
import { circleMembers, circleRoles, circles, eventAgendaItems, eventNotifications, eventRsvps, eventSeries, eventVotes, events, roleMembers, roles } from "./schema";
import { groupBy } from "./util";
import { enqueueCancellationNotifications, enqueueEventNotifications, enqueueMeetingApprovalNotifications, enqueueProposalApprovalNotifications, withdrawEventNotifications } from "./notifications";
import { isWithinCircle } from "@/lib/circles.util";
import { roleKey, validateEventDraft, type EventDetails, type EventDraft, type RoleDraft, type SeriesScope } from "@/lib/events.util";
import { isPastEvent } from "@/lib/format.util";
import { majority } from "@/lib/governance.util";
import { REPEAT_HORIZON_DAYS, addDays, datesBetween, localDay } from "@/lib/recurrence.util";
import type { AgendaItem, Event, EventRepeat, Role } from "@/lib/types";

/* An event belongs to one circle, and that circle is its audience: only the
   circle's members (and, for the city root, everyone) can see it or RSVP to
   it. An event may instead be hosted by a circle, which need not be the one
   it's shown to: it starts as a proposal that only the host circle's members
   can see and vote on, and goes live for its audience once a majority of
   them approve. This file is where all of that is enforced — not the UI, and
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

function toEvent(row: EventRow, rsvps: number[], votes: number[] | undefined, eventRoles: Role[] | undefined, series: SeriesRow | undefined, agenda: AgendaItem[] | undefined): Event {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind ?? undefined,
    circleId: row.circleId,
    ...(row.hostCircleId !== null ? { hostCircleId: row.hostCircleId } : {}),
    ...(row.hostCircleId !== null && row.approvedAt === null ? { proposed: true } : {}),
    ...(row.approvedByRole !== null ? { approvedByRole: row.approvedByRole } : {}),
    ...(row.cancelledAt !== null ? { cancelled: true } : {}),
    organizerId: row.organizerId,
    date: row.date,
    start: toClockTime(row.start),
    end: toClockTime(row.end),
    location: row.location,
    description: row.description,
    rsvps,
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
  const [rsvpRows, voteRows, roleRows, seriesRows, agendaRows] = await Promise.all([
    db.select().from(eventRsvps).where(inArray(eventRsvps.eventId, ids)),
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
      row.kind === "meeting" ? agendaByEvent.get(row.id) || [] : undefined
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
  return row.approvedAt === null ? hosts : hosts || v.audience.includes(row.circleId);
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
        and(isNull(events.approvedAt), anyOf(events.hostCircleId, v.own))
      )
    );
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
  if (row.approvedAt === null) throw new EventError("This event is still waiting on its host circle's vote.");
}

// a cancelled event is closed to everything: RSVPs, votes, signups and edits
function assertNotCancelled(row: EventRow) {
  if (row.cancelledAt !== null) throw new EventError("This event has been cancelled.");
}

async function assertCanPost(v: Viewer, circleId: string): Promise<{ isRoot: boolean }> {
  const [circle] = await db.select({ parentId: circles.parentId }).from(circles).where(eq(circles.id, circleId));
  if (!circle) throw new EventError("That circle doesn't exist.");
  if (!v.audience.includes(circleId)) throw new EventError("You can only post to circles you belong to.");
  return { isRoot: circle.parentId === null };
}

// a circle can host only if it has members of its own to vote (not the city,
// whose roster is implicit), the proposer is one of them, and it's the circle
// the event is shown to or one inside it; returns how many members it has
async function assertCanHost(v: Viewer, circleId: string, audienceCircleId: string): Promise<number> {
  const rows = await db.select({ id: circles.id, parentId: circles.parentId }).from(circles);
  const circle = rows.find((c) => c.id === circleId);
  if (!circle) throw new EventError("That circle doesn't exist.");
  if (circle.parentId === null) throw new EventError("The whole city can't host an event — pick a neighborhood or group.");
  if (!v.own.includes(circleId)) throw new EventError("You can only host on behalf of a circle you belong to.");
  const parents = new Map(rows.map((c) => [c.id, c.parentId]));
  if (!isWithinCircle(circleId, audienceCircleId, (id) => parents.get(id))) {
    throw new EventError("A circle can only host an event shown to itself or to a circle it's part of.");
  }
  const members = await db.select({ id: circleMembers.memberId }).from(circleMembers).where(eq(circleMembers.circleId, circleId));
  return members.length;
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
   attending/voting — whatever the client might have said about those is not
   an input. A circle-hosted event opens with its proposer's vote, and is
   approved on the spot if that alone is a majority (a one-member circle), or
   with no vote at all if its proposer is the host circle's Leader, Secretary
   or Facilitator — as a meeting is when its own circle's is the one who
   creates it (`approvedByRole`).

   A repeating one also creates its series, and with it the dates due in the
   next few weeks (once it's live — a proposal's wait for its approval). Only
   the first date notifies anyone; the email says how it repeats. Returns
   every date created, soonest (the one asked for) first. */
export async function createEvent(memberId: number, draft: EventDraft): Promise<Event[]> {
  const problem = validateEventDraft(draft);
  if (problem) throw new EventError(problem);
  const viewer = await viewerCircles(memberId);
  const { isRoot } = await assertCanPost(viewer, draft.circleId);
  const hostSize = draft.hostCircleId ? await assertCanHost(viewer, draft.hostCircleId, draft.circleId) : 0;
  if (draft.kind === "meeting" && isRoot) throw new EventError("A meeting needs a circle with its own members — pick a neighborhood or group.");
  // the Leader, Secretary or Facilitator of the circle that would vote on it —
  // a meeting's own circle, or the host circle — approves it by creating it:
  // a meeting is scheduled outright (and attended by RSVP), a circle-hosted
  // event opens to its circle at once. No vote, so none is cast.
  const votingCircleId = draft.kind === "meeting" ? draft.circleId : draft.hostCircleId;
  const approvedByRole = votingCircleId ? await builtinRoleOf(memberId, votingCircleId) : null;
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
  };
  const proposed = !!draft.hostCircleId && !approvedByRole && majority(hostSize) > 1;
  const first: Event = {
    ...newDate(template, draft.date, { opening: true, proposed }),
    ...(draft.kind === "meeting" ? { agenda: cleanAgenda(draft.agenda) } : {}),
  };
  const repeat = draft.repeat;
  if (!repeat) return [await insertEvent(first, { notifyMembers: true })];
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
        approvedAt: proposed ? null : new Date(),
      })
      .returning();
    if (!series) throw new EventError("Couldn't save that — try again.");
    await writeEvent(tx, { ...first, repeat: toRepeat(series) }, { notifyMembers: true });
    await extendSeries(tx, series);
  });
  return loadSeries(seriesId);
}

// the built-in role a member holds in a circle, if any — the server's own read
// of what approvingRole (lib/circle-roles.util.ts) checks in the form.
// Posting a meeting or hosting an event already requires membership, so a
// holder here is a member.
async function builtinRoleOf(memberId: number, circleId: string): Promise<string | null> {
  const [held] = await db
    .select({ label: circleRoles.label })
    .from(circleRoles)
    .where(and(eq(circleRoles.circleId, circleId), eq(circleRoles.memberId, memberId), eq(circleRoles.builtin, true)))
    .orderBy(asc(circleRoles.position))
    .limit(1);
  return held?.label ?? null;
}

// what an event's fixed facts are made from — a draft being created, or a
// series' saved template for its later dates
type Template = Pick<SeriesRow, "title" | "kind" | "circleId" | "hostCircleId" | "organizerId" | "approvedByRole" | "start" | "end" | "location" | "description" | "roles">;

/* A date's starting state. The organizer attends their own event — except a
   slotted one, where people sign up for slots instead, and a circle-hosted
   one, which opens for RSVPs only once approved — and a meeting opens with
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
  if (row.organizerId !== memberId) throw new EventError("Only the person hosting this event can edit it.");
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
  };
  const targets = await db.transaction(async (tx) => {
    // the event before its series, the order setVote locks them in
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
    for (const target of ids) {
      await tx
        .update(events)
        .set({ ...fields, ...(target === id ? { date: details.date } : {}) })
        .where(eq(events.id, target));
      // a slot that keeps its name keeps the people already in it, per date
      await writeRoles(tx, target, buildRoles(details.roles, existing.find((e) => e.id === target)?.roles));
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
  assertLive(row);
  // a meeting its circle's Leader, Secretary or Facilitator scheduled has no vote to attend by
  if (row.kind === "meeting" && row.approvedByRole === null) throw new EventError("Meetings are attended by voting.");
  const [slot] = await db.select({ id: roles.id }).from(roles).where(eq(roles.eventId, id)).limit(1);
  if (slot) throw new EventError("This event uses signup slots — take a slot instead.");
  if (going) await db.insert(eventRsvps).values({ eventId: id, memberId }).onConflictDoNothing();
  else await db.delete(eventRsvps).where(and(eq(eventRsvps.eventId, id), eq(eventRsvps.memberId, memberId)));
  return loadFull(id);
}

// vote on a meeting or on a circle-hosted proposal. For a meeting, voting and
// attending are one act, so the RSVP follows the vote. For a proposal a vote
// is an approval only (attending opens once it's live), and the vote that
// reaches a majority of the host circle approves it for good.
export async function setVote(memberId: number, id: string, voting: boolean): Promise<Event> {
  const row = await loadVisible(memberId, id);
  assertNotCancelled(row);
  if (row.kind === "meeting") {
    if (row.approvedByRole !== null) throw new EventError(`This meeting was scheduled by its circle's ${row.approvedByRole}, so there's no vote — RSVP instead.`);
    await db.transaction(async (tx) => {
      // serialize votes on this meeting, so the vote that reaches the
      // threshold is seen as the one that did (see enqueueMeetingApprovalNotifications)
      await tx.select({ id: events.id }).from(events).where(eq(events.id, id)).for("update");
      if (voting) {
        await tx.insert(eventVotes).values({ eventId: id, memberId }).onConflictDoNothing();
        await tx.insert(eventRsvps).values({ eventId: id, memberId }).onConflictDoNothing();
        // a meeting's approval is recomputed from its votes (not stored),
        // so the moment to announce it is the vote that lands exactly on the
        // majority of its circle
        const [votes, circleMembersRows] = await Promise.all([
          tx.select().from(eventVotes).where(eq(eventVotes.eventId, id)),
          tx.select().from(circleMembers).where(eq(circleMembers.circleId, row.circleId)),
        ]);
        if (votes.length === majority(circleMembersRows.length)) await enqueueMeetingApprovalNotifications(tx, row, memberId);
      } else {
        await tx.delete(eventVotes).where(and(eq(eventVotes.eventId, id), eq(eventVotes.memberId, memberId)));
        await tx.delete(eventRsvps).where(and(eq(eventRsvps.eventId, id), eq(eventRsvps.memberId, memberId)));
      }
    });
    return loadFull(id);
  }
  const hostCircleId = row.hostCircleId;
  if (hostCircleId === null) throw new EventError("Only meetings and proposed events are voted on.");
  await db.transaction(async (tx) => {
    // lock the event so two members' votes can't each miss the other's and
    // leave a majority unnoticed
    const [locked] = await tx.select().from(events).where(eq(events.id, id)).for("update");
    if (!locked || locked.approvedAt !== null) throw new EventError("This event has already been approved.");
    if (voting) await tx.insert(eventVotes).values({ eventId: id, memberId }).onConflictDoNothing();
    else await tx.delete(eventVotes).where(and(eq(eventVotes.eventId, id), eq(eventVotes.memberId, memberId)));
    if (!voting) return;
    const [votes, members] = await Promise.all([
      tx.select().from(eventVotes).where(eq(eventVotes.eventId, id)),
      tx.select().from(circleMembers).where(eq(circleMembers.circleId, hostCircleId)),
    ]);
    if (votes.length >= majority(members.length)) {
      await tx.update(events).set({ approvedAt: new Date() }).where(eq(events.id, id));
      // approving is what makes it visible to its circle, so tell them — in
      // this same transaction, so an approval can't happen without its emails
      await enqueueProposalApprovalNotifications(tx, locked, memberId);
      // the first date of a series is the vote on the whole series: approving
      // it adds the rest, approved and silent (this date's email covers them)
      if (locked.seriesId !== null) {
        const [series] = await tx
          .update(eventSeries)
          .set({ approvedAt: new Date() })
          .where(and(eq(eventSeries.id, locked.seriesId), isNull(eventSeries.approvedAt)))
          .returning();
        if (series) await extendSeries(tx, series);
      }
    }
  });
  return loadFull(id);
}

// take a slot (leaving any other one — a person holds one at a time, and a
// slot with a max can be full) or leave the one they hold
export async function toggleRoleSlot(memberId: number, id: string, key: string): Promise<Event> {
  const row = await loadVisible(memberId, id);
  assertNotCancelled(row);
  assertLive(row);
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
export async function cancelEvent(memberId: number, id: string, scope: SeriesScope = "one"): Promise<{ deletedIds: string[]; events: Event[] }> {
  const row = await loadVisible(memberId, id);
  if (row.organizerId !== memberId) throw new EventError("Only the person hosting this event can cancel it.");
  assertNotCancelled(row);
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

/* cancelEvent's work on one event, whose row the caller has locked: deleted
   if no one but the organizer was going, otherwise marked cancelled — and
   either way anything unsent about it withdrawn. Returns who was going, for
   the caller to decide who's emailed. */
async function cancelOne(tx: Tx, id: string, organizerId: number): Promise<{ deleted: boolean; going: number[] }> {
  const eventRoles = await tx.select({ id: roles.id }).from(roles).where(eq(roles.eventId, id));
  const roleIds = eventRoles.map((r) => r.id);
  const [rsvpRows, slotRows] = await Promise.all([
    tx.select({ memberId: eventRsvps.memberId }).from(eventRsvps).where(eq(eventRsvps.eventId, id)),
    roleIds.length > 0 ? tx.select({ memberId: roleMembers.memberId }).from(roleMembers).where(inArray(roleMembers.roleId, roleIds)) : Promise.resolve([]),
  ]);
  const going = [...new Set([...rsvpRows, ...slotRows].map((r) => r.memberId))].filter((m) => m !== organizerId);
  await withdrawEventNotifications(tx, id);
  if (going.length === 0) {
    if (roleIds.length > 0) await tx.delete(roleMembers).where(inArray(roleMembers.roleId, roleIds));
    await tx.delete(roles).where(eq(roles.eventId, id));
    await tx.delete(eventVotes).where(eq(eventVotes.eventId, id));
    await tx.delete(eventRsvps).where(eq(eventRsvps.eventId, id));
    await tx.delete(eventNotifications).where(eq(eventNotifications.eventId, id));
    await tx.delete(events).where(eq(events.id, id));
    return { deleted: true, going };
  }
  await tx.update(events).set({ cancelledAt: new Date() }).where(eq(events.id, id));
  return { deleted: false, going };
}
