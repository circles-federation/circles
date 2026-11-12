import { and, asc, eq, sql } from "drizzle-orm";
import { db, type Tx } from "./client";
import { UserFacingError } from "./errors";
import { MEETING_CHANNEL } from "./meeting-channel";
import { createTask, getMeetingTasks, type TaskChange } from "./tasks";
import { circleMembers, circleRoles, eventAgendaItems, eventRsvps, events, meetingAttendance, meetingSessions, meetingTopicNotes } from "./schema";
import { MAX_AGENDA_ITEMS, validateAgendaItem } from "@/lib/agenda.util";
import { eventEndsAt } from "@/lib/events.util";
import { MEETING_RUN_GRACE_MS, canRunMeeting, defaultFacilitator, lastStep, stepAfterTopicAdded, stepAfterTopicRemoved, validateNotes } from "@/lib/meeting-session.util";
import type { TaskInput } from "@/lib/tasks.util";
import type { AgendaItem, CircleTask, MeetingSession } from "@/lib/types";

/* A meeting being held, its circle's members' alone: this file is where that's
   held to. Every call checks the meeting is an approved, uncancelled meeting of
   a circle the member belongs to, and to anyone else it doesn't exist. One
   facilitator moves it on and finishes it (the circle's Facilitator, unless
   they're not there: any attendee can take over). Attendance is
   marked present (meeting_attendance), which also RSVPs them. Notes are plain Markdown, last write wins. Like the rest of lib/db it
   takes the acting member's id and never reads the session itself. */

export class MeetingError extends UserFacingError {}

const GONE = "That meeting doesn't exist.";

type EventRow = typeof events.$inferSelect;
type SessionRow = typeof meetingSessions.$inferSelect;

async function isMember(tx: Tx | typeof db, circleId: string, memberId: number): Promise<boolean> {
  const [row] = await tx
    .select({ id: circleMembers.memberId })
    .from(circleMembers)
    .where(and(eq(circleMembers.circleId, circleId), eq(circleMembers.memberId, memberId)));
  return !!row;
}

// the meeting's event, if it's one this member may run: reported as missing otherwise
async function loadMeeting(tx: Tx, memberId: number, eventId: string, lock = false): Promise<EventRow> {
  const query = tx.select().from(events).where(eq(events.id, eventId));
  const [row] = await (lock ? query.for("update") : query);
  if (!row || row.kind !== "meeting" || row.approvedAt === null || row.cancelledAt !== null || !(await isMember(tx, row.circleId, memberId))) throw new MeetingError(GONE);
  return row;
}

async function readSession(tx: Tx | typeof db, eventId: string): Promise<MeetingSession | null> {
  const [s] = await tx.select().from(meetingSessions).where(eq(meetingSessions.eventId, eventId));
  if (!s) return null;
  const topics = await tx.select().from(meetingTopicNotes).where(eq(meetingTopicNotes.eventId, eventId)).orderBy(asc(meetingTopicNotes.position));
  const attendees = await tx.select({ id: meetingAttendance.memberId }).from(meetingAttendance).where(eq(meetingAttendance.eventId, eventId));
  return {
    eventId,
    status: s.status,
    step: s.step,
    facilitatorId: s.facilitatorId,
    attendees: attendees.map((a) => a.id).sort((a, b) => a - b),
    tasks: await getMeetingTasks(tx, eventId),
    topics: topics.map((t) => ({ id: t.id, position: t.position, category: t.category, title: t.title, ...(t.details !== null ? { details: t.details } : {}), notes: t.notes })),
    startedAt: s.startedAt.toISOString(),
    ...(s.finishedAt ? { finishedAt: s.finishedAt.toISOString() } : {}),
    rev: s.rev,
    ...(s.minutesEditedBy !== null ? { minutesEditedBy: s.minutesEditedBy } : {}),
    ...(s.minutesEditedAt ? { minutesEditedAt: s.minutesEditedAt.toISOString() } : {}),
  };
}

// announces a change to whoever's streaming the meeting (lib/db/meeting-stream.ts);
// sent inside the writing transaction, so only a committed change is heard
const announce = (tx: Tx, eventId: string) => tx.execute(sql`select pg_notify(${MEETING_CHANNEL}, ${eventId})`);

async function bump(tx: Tx, eventId: string, set: Partial<typeof meetingSessions.$inferInsert> = {}) {
  await tx.update(meetingSessions).set({ ...set, rev: sql`${meetingSessions.rev} + 1` }).where(eq(meetingSessions.eventId, eventId));
  await announce(tx, eventId);
}

/* Runs a change to a started meeting under a lock on its session, and returns
   the session as it is afterwards. */
async function change(memberId: number, eventId: string, fn: (tx: Tx, session: SessionRow, event: EventRow) => Promise<void>): Promise<MeetingSession> {
  return db.transaction(async (tx) => {
    const event = await loadMeeting(tx, memberId, eventId);
    const [session] = await tx.select().from(meetingSessions).where(eq(meetingSessions.eventId, eventId)).for("update");
    if (!session) throw new MeetingError("This meeting hasn't started.");
    await fn(tx, session, event);
    const after = await readSession(tx, eventId);
    if (!after) throw new MeetingError(GONE);
    return after;
  });
}

function assertLive(session: SessionRow) {
  if (session.status !== "live") throw new MeetingError("This meeting has finished.");
}

function assertFacilitator(session: SessionRow, memberId: number) {
  if (session.facilitatorId !== memberId) throw new MeetingError("Only the facilitator can do that.");
}

async function attends(tx: Tx, eventId: string, memberId: number): Promise<boolean> {
  const [row] = await tx.select({ id: meetingAttendance.memberId }).from(meetingAttendance).where(and(eq(meetingAttendance.eventId, eventId), eq(meetingAttendance.memberId, memberId)));
  return !!row;
}

// whether the member may see this meeting at all, started or not (the stream's
// gate: to anyone else it doesn't exist)
export async function memberHasMeeting(memberId: number, eventId: string): Promise<boolean> {
  return db.transaction((tx) =>
    loadMeeting(tx, memberId, eventId).then(
      () => true,
      () => false
    )
  );
}

// a meeting's session (null before it starts) and who may see it, for the hub
// to hand on to those streaming it; null if there's no such meeting
export async function getMeetingForFanout(eventId: string): Promise<{ session: MeetingSession | null; memberIds: number[] } | null> {
  const [row] = await db.select().from(events).where(eq(events.id, eventId));
  if (!row || row.kind !== "meeting" || row.approvedAt === null || row.cancelledAt !== null) return null;
  const memberIds = (await db.select({ id: circleMembers.memberId }).from(circleMembers).where(eq(circleMembers.circleId, row.circleId))).map((r) => r.id);
  return { session: await readSession(db, eventId), memberIds };
}

// the session, if the member is in the meeting's circle and it has started
export async function getMeetingSession(memberId: number, eventId: string): Promise<MeetingSession | null> {
  return db.transaction(async (tx) => {
    const loaded = await loadMeeting(tx, memberId, eventId).then(
      () => true,
      () => false
    );
    return loaded ? readSession(tx, eventId) : null;
  });
}

/* Starts the meeting, or joins it if it's already going: from its start time
   until a day after its end, once. The agenda is copied into it, the
   facilitator is the circle's Facilitator (or, if there's none, whoever
   pressed the button), and whoever starts it is there. */
export async function startMeeting(memberId: number, eventId: string, now: Date = new Date()): Promise<MeetingSession> {
  return db.transaction(async (tx) => {
    const event = await loadMeeting(tx, memberId, eventId, true);
    const existing = await readSession(tx, eventId);
    if (existing) {
      if (existing.status === "finished") throw new MeetingError("This meeting has finished.");
      return existing;
    }
    if (!canRunMeeting(event, now)) throw new MeetingError("A meeting can be run from its start time until a day after it ends.");
    const agenda = await tx.select().from(eventAgendaItems).where(eq(eventAgendaItems.eventId, eventId)).orderBy(asc(eventAgendaItems.position));
    if (agenda.length === 0) throw new MeetingError("This meeting has no agenda.");
    const [holder] = await tx
      .select({ id: circleRoles.memberId })
      .from(circleRoles)
      .where(and(eq(circleRoles.circleId, event.circleId), eq(circleRoles.label, "Facilitator")));
    const memberIds = (await tx.select({ id: circleMembers.memberId }).from(circleMembers).where(eq(circleMembers.circleId, event.circleId))).map((r) => r.id);
    await tx.insert(meetingSessions).values({ eventId, facilitatorId: defaultFacilitator(holder?.id ?? null, memberId, memberIds), startedAt: now });
    await tx.insert(meetingTopicNotes).values(agenda.map((a, position) => ({ eventId, position, category: a.category, title: a.title, details: a.details })));
    await tx.insert(meetingAttendance).values({ eventId, memberId });
    await tx.insert(eventRsvps).values({ eventId, memberId }).onConflictDoNothing();
    await announce(tx, eventId);
    const started = await readSession(tx, eventId);
    if (!started) throw new MeetingError(GONE);
    return started;
  });
}

async function topicCount(tx: Tx, eventId: string): Promise<number> {
  const [row] = await tx.select({ count: sql<number>`count(*)::int` }).from(meetingTopicNotes).where(eq(meetingTopicNotes.eventId, eventId));
  return row?.count ?? 0;
}

// the facilitator moves the wizard to a step (see stepAt)
export async function setStep(memberId: number, eventId: string, step: number): Promise<MeetingSession> {
  return change(memberId, eventId, async (tx, session) => {
    assertLive(session);
    assertFacilitator(session, memberId);
    const count = await topicCount(tx, eventId);
    if (!Number.isInteger(step) || step < 0 || step > lastStep(count)) throw new MeetingError("There's no such step.");
    await bump(tx, eventId, { step });
  });
}

/* Adds a topic to the end of the agenda as it stands in this meeting (the
   event's own agenda is left alone), for the people there to review before
   discussing. Any attendee may; where the wizard is follows (stepAfterTopicAdded). */
export async function addTopic(memberId: number, eventId: string, item: AgendaItem): Promise<MeetingSession> {
  const problem = validateAgendaItem(item);
  if (problem) throw new MeetingError(problem);
  return change(memberId, eventId, async (tx, session) => {
    assertLive(session);
    if (!(await attends(tx, eventId, memberId))) throw new MeetingError("Mark yourself present to change the agenda.");
    const count = await topicCount(tx, eventId);
    if (count >= MAX_AGENDA_ITEMS) throw new MeetingError(`Keep the agenda to ${MAX_AGENDA_ITEMS} topics or fewer.`);
    const details = item.details?.trim();
    await tx.insert(meetingTopicNotes).values({ eventId, position: count, category: item.category, title: item.title.trim(), details: details ? details : null });
    await bump(tx, eventId, { step: stepAfterTopicAdded(session.step, count) });
  });
}

// takes a topic off the agenda, with whatever was written on it, and closes the gap
export async function removeTopic(memberId: number, eventId: string, topicId: string): Promise<MeetingSession> {
  return change(memberId, eventId, async (tx, session) => {
    assertLive(session);
    if (!(await attends(tx, eventId, memberId))) throw new MeetingError("Mark yourself present to change the agenda.");
    const [removed] = await tx.delete(meetingTopicNotes).where(and(eq(meetingTopicNotes.eventId, eventId), eq(meetingTopicNotes.id, topicId))).returning({ position: meetingTopicNotes.position });
    if (!removed) throw new MeetingError("There's no such topic.");
    const position = removed.position;
    // the key is (event, position), so the topics after it close up by way of
    // negatives, where no two ever share a position part-way
    await tx.update(meetingTopicNotes).set({ position: sql`-${meetingTopicNotes.position}` }).where(and(eq(meetingTopicNotes.eventId, eventId), sql`${meetingTopicNotes.position} > ${position}`));
    await tx.update(meetingTopicNotes).set({ position: sql`-${meetingTopicNotes.position} - 1` }).where(and(eq(meetingTopicNotes.eventId, eventId), sql`${meetingTopicNotes.position} < 0`));
    const count = await topicCount(tx, eventId);
    await bump(tx, eventId, { step: stepAfterTopicRemoved(session.step, count + 1, position) });
  });
}

/* A task that comes out of the meeting, made by anyone there: an ordinary task
   of the meeting's circle (its rules and checks, lib/db/tasks.ts), marked as
   from this meeting so the minutes can list it. Returns the session and the
   task, with whoever it was just given to, for the caller to tell. */
export async function addMeetingTask(memberId: number, eventId: string, input: TaskInput): Promise<{ session: MeetingSession; task: CircleTask; assignedTo: number | null }> {
  let made: TaskChange | null = null;
  const session = await change(memberId, eventId, async (tx, session, event) => {
    assertLive(session);
    if (!(await attends(tx, eventId, memberId))) throw new MeetingError("Mark yourself present to add tasks.");
    made = await createTask(memberId, event.circleId, input, eventId, tx);
    await bump(tx, eventId);
  });
  const { task, assignedTo } = made as unknown as TaskChange;
  return { session, task, assignedTo };
}

// any attendee can take over as facilitator, in case the usual one isn't there
export async function takeOverFacilitator(memberId: number, eventId: string): Promise<MeetingSession> {
  return change(memberId, eventId, async (tx, session) => {
    assertLive(session);
    if (!(await attends(tx, eventId, memberId))) throw new MeetingError("Mark yourself present to take over.");
    await bump(tx, eventId, { facilitatorId: memberId });
  });
}

// marks a member present or not: anyone for themself, the facilitator for others
export async function setPresent(memberId: number, eventId: string, targetId: number, present: boolean): Promise<MeetingSession> {
  return change(memberId, eventId, async (tx, session, event) => {
    assertLive(session);
    if (targetId !== memberId) assertFacilitator(session, memberId);
    if (!(await isMember(tx, event.circleId, targetId))) throw new MeetingError("They aren't a member of this circle.");
    if (present) {
      await tx.insert(meetingAttendance).values({ eventId, memberId: targetId }).onConflictDoNothing();
      await tx.insert(eventRsvps).values({ eventId, memberId: targetId }).onConflictDoNothing();
    } else {
      // their RSVP stays: it may be theirs from before the meeting
      await tx.delete(meetingAttendance).where(and(eq(meetingAttendance.eventId, eventId), eq(meetingAttendance.memberId, targetId)));
    }
    await bump(tx, eventId);
  });
}

/* Saves what's written about a topic, replacing it. While the meeting's live,
   its attendees write; once it's finished, any member of the circle can
   correct the minutes. Either way the editor and the time are recorded. */
export async function saveTopicNotes(memberId: number, eventId: string, topicId: string, notes: string): Promise<MeetingSession> {
  const problem = validateNotes(notes);
  if (problem) throw new MeetingError(problem);
  return change(memberId, eventId, async (tx, session) => {
    if (session.status === "live" && !(await attends(tx, eventId, memberId))) throw new MeetingError("Mark yourself present to take notes.");
    const updated = await tx
      .update(meetingTopicNotes)
      .set({ notes })
      .where(and(eq(meetingTopicNotes.eventId, eventId), eq(meetingTopicNotes.id, topicId)))
      .returning({ id: meetingTopicNotes.id });
    if (updated.length === 0) throw new MeetingError("There's no such topic.");
    await bump(tx, eventId, { minutesEditedBy: memberId, minutesEditedAt: new Date() });
  });
}

/* Corrects the minutes of a meeting that's finished: the notes of the topics
   that changed, saved together as one edit by this member. Only what's sent is
   written, so someone else's correction to another topic isn't undone by a
   copy that was out of date. Any member of the circle may; while the meeting's
   live the wizard's own notes (saveTopicNotes) are what's written. */
export async function saveMinutes(memberId: number, eventId: string, edits: { topicId: string; notes: string }[]): Promise<MeetingSession> {
  if (edits.length === 0) throw new MeetingError("There's nothing to save.");
  if (new Set(edits.map((e) => e.topicId)).size !== edits.length) throw new MeetingError("A topic can only be edited once.");
  for (const edit of edits) {
    const problem = validateNotes(edit.notes);
    if (problem) throw new MeetingError(problem);
  }
  return change(memberId, eventId, async (tx, session) => {
    if (session.status !== "finished") throw new MeetingError("The minutes can be corrected once the meeting has finished.");
    for (const { topicId, notes } of edits) {
      const updated = await tx
        .update(meetingTopicNotes)
        .set({ notes })
        .where(and(eq(meetingTopicNotes.eventId, eventId), eq(meetingTopicNotes.id, topicId)))
        .returning({ id: meetingTopicNotes.id });
      if (updated.length === 0) throw new MeetingError("There's no such topic.");
    }
    await bump(tx, eventId, { minutesEditedBy: memberId, minutesEditedAt: new Date() });
  });
}

// the facilitator closes the meeting; its minutes stay editable
export async function finishMeeting(memberId: number, eventId: string, now: Date = new Date()): Promise<MeetingSession> {
  return change(memberId, eventId, async (tx, session) => {
    assertLive(session);
    assertFacilitator(session, memberId);
    await bump(tx, eventId, { status: "finished", finishedAt: now });
  });
}

/* A meeting no one finished is finished for them once its run window has
   closed (a day after it ended: canRunMeeting), so it doesn't stay live for
   ever and its minutes open to correction. Run by the notification poller;
   each session is locked and checked again as it's closed. Returns how many. */
export async function finishLapsedMeetings(now: Date = new Date()): Promise<number> {
  const live = await db
    .select({ eventId: meetingSessions.eventId, date: events.date, start: events.start, end: events.end })
    .from(meetingSessions)
    .innerJoin(events, eq(events.id, meetingSessions.eventId))
    .where(eq(meetingSessions.status, "live"));
  const lapsed = live.filter((m) => now.getTime() >= eventEndsAt(m).getTime() + MEETING_RUN_GRACE_MS);
  let finished = 0;
  for (const { eventId } of lapsed) {
    // one meeting's failure mustn't leave the rest of the batch live
    try {
      await db.transaction(async (tx) => {
        const [session] = await tx.select().from(meetingSessions).where(eq(meetingSessions.eventId, eventId)).for("update");
        if (!session || session.status !== "live") return;
        await bump(tx, eventId, { status: "finished", finishedAt: now });
        finished++;
      });
    } catch (error) {
      console.error(`Finishing lapsed meeting ${eventId} failed`, error);
    }
  }
  return finished;
}
