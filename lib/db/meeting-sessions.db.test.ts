import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { event } from "@/lib/test/factories";
import { db } from "./client";
import { insertEvent } from "./events";
import { addMeetingTask, addTopic, finishLapsedMeetings, finishMeeting, saveMinutes, getMeetingForFanout, getMeetingSession, memberHasMeeting, removeTopic, saveTopicNotes, setPresent, setStep, startMeeting, takeOverFacilitator } from "./meeting-sessions";
import { addCircle, addMember, giveRole, join, resetDb } from "./testing";

/* A live meeting: who may start it and when, who drives, who's there, and
   who writes the notes and minutes. */

const AGENDA = [
  { category: "report" as const, title: "Treasurer's report" },
  { category: "decide" as const, title: "Budget", details: "Next quarter" },
];
// the meeting is 2026-11-10, 10:00 to 12:00
const during = new Date(2026, 10, 10, 10, 30);

beforeEach(async () => {
  await resetDb();
  for (const id of [1, 2, 3, 4]) await addMember(id);
  await addCircle("city", { type: "other" });
  await addCircle("council", { type: "circle", parentId: "city" });
  await join("council", 1, 2, 3);
  await insertEvent(event({ id: "m1", circleId: "council", kind: "meeting", agenda: AGENDA }));
});

describe("starting a meeting", () => {
  it("copies the agenda, marks the starter present and makes them facilitator when no one holds the role", async () => {
    const s = await startMeeting(1, "m1", during);
    expect(s).toMatchObject({ status: "live", step: 0, facilitatorId: 1, attendees: [1], rev: 0 });
    expect(s.topics).toEqual([
      { position: 0, category: "report", title: "Treasurer's report", notes: "" },
      { position: 1, category: "decide", title: "Budget", details: "Next quarter", notes: "" },
    ]);
  });

  it("makes the circle's Facilitator the facilitator, though they haven't arrived", async () => {
    await giveRole("council", "Facilitator", 3);
    const s = await startMeeting(1, "m1", during);
    expect(s.facilitatorId).toBe(3);
    expect(s.attendees).toEqual([1]);
  });

  it("joins a meeting that's already going instead of starting another", async () => {
    await giveRole("council", "Facilitator", 2);
    await startMeeting(1, "m1", during);
    const s = await startMeeting(2, "m1", during);
    expect(s.facilitatorId).toBe(2);
    expect(s.attendees).toEqual([1]);
  });

  it("refuses before the start time and more than a day after the end", async () => {
    await expect(startMeeting(1, "m1", new Date(2026, 10, 10, 9, 59))).rejects.toThrow(/from its start time/);
    await expect(startMeeting(1, "m1", new Date(2026, 10, 11, 12, 0))).rejects.toThrow(/from its start time/);
  });

  it("is only for members of the meeting's circle, to whom it's no different from a missing one", async () => {
    await expect(startMeeting(4, "m1", during)).rejects.toThrow("That meeting doesn't exist.");
    await expect(startMeeting(1, "nope", during)).rejects.toThrow("That meeting doesn't exist.");
  });

  it("is only for approved meetings that aren't cancelled", async () => {
    await insertEvent(event({ id: "plain", circleId: "council" }));
    await insertEvent(event({ id: "m2", circleId: "council", kind: "meeting", proposed: true, agenda: AGENDA }));
    await insertEvent(event({ id: "m3", circleId: "council", kind: "meeting", agenda: AGENDA }));
    await db.execute(sql`update events set cancelled_at = now() where id = 'm3'`);
    for (const id of ["plain", "m2", "m3"]) await expect(startMeeting(1, id, during)).rejects.toThrow("That meeting doesn't exist.");
  });

  it("can't be started again once it's finished", async () => {
    await startMeeting(1, "m1", during);
    await finishMeeting(1, "m1");
    await expect(startMeeting(1, "m1", during)).rejects.toThrow("This meeting has finished.");
  });

  it("keeps the topics as they were when the agenda is edited afterwards", async () => {
    await startMeeting(1, "m1", during);
    await db.execute(sql`delete from event_agenda_items where event_id = 'm1'`);
    expect((await getMeetingSession(1, "m1"))?.topics.map((t) => t.title)).toEqual(["Treasurer's report", "Budget"]);
  });
});

describe("reading a session", () => {
  it("is for the circle's members alone", async () => {
    await startMeeting(1, "m1", during);
    expect(await getMeetingSession(2, "m1")).not.toBeNull();
    expect(await getMeetingSession(4, "m1")).toBeNull();
  });

  it("is null before it starts", async () => {
    expect(await getMeetingSession(1, "m1")).toBeNull();
  });
});

describe("moving through the steps", () => {
  beforeEach(async () => {
    await startMeeting(1, "m1", during);
  });

  it("is the facilitator's alone", async () => {
    await expect(setStep(2, "m1", 1)).rejects.toThrow("Only the facilitator can do that.");
    expect((await setStep(1, "m1", 1)).step).toBe(1);
  });

  it("stays between attendance and the wrap-up", async () => {
    expect((await setStep(1, "m1", 5)).step).toBe(5);
    await expect(setStep(1, "m1", 6)).rejects.toThrow("There's no such step.");
    await expect(setStep(1, "m1", -1)).rejects.toThrow("There's no such step.");
  });

  it("counts each change in the session's rev", async () => {
    await setStep(1, "m1", 1);
    expect((await setStep(1, "m1", 2)).rev).toBe(2);
  });
});

describe("the facilitator's role", () => {
  beforeEach(async () => {
    await giveRole("council", "Facilitator", 3);
    await startMeeting(1, "m1", during);
  });

  it("can be taken by an attendee, but not by someone who isn't there", async () => {
    await expect(takeOverFacilitator(2, "m1")).rejects.toThrow("Mark yourself present to take over.");
    expect((await takeOverFacilitator(1, "m1")).facilitatorId).toBe(1);
  });

  it("then moves the wizard, not the one who was handed it", async () => {
    await takeOverFacilitator(1, "m1");
    await expect(setStep(3, "m1", 1)).rejects.toThrow("Only the facilitator can do that.");
    expect((await setStep(1, "m1", 1)).step).toBe(1);
  });
});

describe("attendance", () => {
  beforeEach(async () => {
    await startMeeting(1, "m1", during);
  });

  it("lets anyone in the circle mark themself present and absent", async () => {
    expect((await setPresent(2, "m1", 2, true)).attendees).toEqual([1, 2]);
    expect((await setPresent(2, "m1", 2, false)).attendees).toEqual([1]);
  });

  it("lets only the facilitator mark someone else", async () => {
    await expect(setPresent(2, "m1", 3, true)).rejects.toThrow("Only the facilitator can do that.");
    expect((await setPresent(1, "m1", 3, true)).attendees).toEqual([1, 3]);
  });

  it("is only for members of the circle", async () => {
    await expect(setPresent(1, "m1", 4, true)).rejects.toThrow("They aren't a member of this circle.");
  });

  it("starts from who had RSVPed", async () => {
    await insertEvent(event({ id: "m2", circleId: "council", kind: "meeting", agenda: AGENDA, rsvps: [2, 3] }));
    expect((await startMeeting(1, "m2", during)).attendees).toEqual([1, 2, 3]);
  });
});

describe("reviewing the agenda", () => {
  beforeEach(async () => {
    await startMeeting(1, "m1", during);
  });

  it("lets an attendee add a topic to the end, leaving the event's own agenda alone", async () => {
    const s = await addTopic(1, "m1", { category: "explore", title: "  Winter coats ", details: "  who has spares " });
    expect(s.topics.map((t) => t.title)).toEqual(["Treasurer's report", "Budget", "Winter coats"]);
    expect(s.topics[2]).toMatchObject({ position: 2, category: "explore", details: "who has spares", notes: "" });
    const { rows } = await db.execute<{ n: number }>(sql`select count(*)::int as n from event_agenda_items where event_id = 'm1'`);
    expect(rows[0]?.n).toBe(2);
  });

  it("is for those who are there, not those who haven't marked themselves", async () => {
    await expect(addTopic(2, "m1", { category: "report", title: "x" })).rejects.toThrow("Mark yourself present to change the agenda.");
    await expect(removeTopic(2, "m1", 0)).rejects.toThrow("Mark yourself present to change the agenda.");
  });

  it("refuses a topic with no title, and one past the limit", async () => {
    await expect(addTopic(1, "m1", { category: "report", title: "  " })).rejects.toThrow("Give the topic a title.");
    for (let i = 2; i < 30; i++) await addTopic(1, "m1", { category: "report", title: `t${i}` });
    await expect(addTopic(1, "m1", { category: "report", title: "one more" })).rejects.toThrow(/30 topics/);
  });

  it("takes a topic away with its notes and closes the gap", async () => {
    await addTopic(1, "m1", { category: "explore", title: "Third" });
    await saveTopicNotes(1, "m1", 2, "third's notes");
    const s = await removeTopic(1, "m1", 0);
    expect(s.topics.map((t) => [t.position, t.title])).toEqual([[0, "Budget"], [1, "Third"]]);
    expect(s.topics[1]?.notes).toBe("third's notes");
    await expect(removeTopic(1, "m1", 5)).rejects.toThrow("There's no such topic.");
  });

  it("keeps the wizard where it was: on the same topic, and tasks and the wrap-up after them", async () => {
    await setStep(1, "m1", 3);
    expect((await removeTopic(1, "m1", 0)).step).toBe(2);
    expect((await addTopic(1, "m1", { category: "report", title: "New" })).step).toBe(2);
    await setStep(1, "m1", 5);
    expect((await addTopic(1, "m1", { category: "report", title: "Newer" })).step).toBe(6);
    expect((await removeTopic(1, "m1", 1)).step).toBe(5);
  });

  it("is closed once the meeting has finished", async () => {
    await finishMeeting(1, "m1");
    await expect(addTopic(1, "m1", { category: "report", title: "x" })).rejects.toThrow("This meeting has finished.");
  });
});

describe("tasks from the meeting", () => {
  const input = { title: "Book the hall", description: "", status: "todo" as const, priority: "none" as const, dueDate: "2026-11-20", assigneeId: null as number | null };

  beforeEach(async () => {
    await startMeeting(1, "m1", during);
  });

  it("makes an ordinary task of the circle, marked as from the meeting and listed in its session", async () => {
    const { session, task, assignedTo } = await addMeetingTask(1, "m1", input);
    expect(task).toMatchObject({ circleId: "council", title: "Book the hall", dueDate: "2026-11-20", meetingEventId: "m1", createdBy: 1 });
    expect(assignedTo).toBeNull();
    expect(session.tasks.map((t) => t.id)).toEqual([task.id]);
    expect(session.rev).toBe(1);
    expect((await getMeetingSession(2, "m1"))?.tasks).toHaveLength(1);
  });

  it("says who it was given to, when it's someone other than the one adding it", async () => {
    expect((await addMeetingTask(1, "m1", { ...input, assigneeId: 2 })).assignedTo).toBe(2);
    expect((await addMeetingTask(1, "m1", { ...input, assigneeId: 1 })).assignedTo).toBeNull();
  });

  it("refuses an assignee outside the circle, and a task with no title", async () => {
    await expect(addMeetingTask(1, "m1", { ...input, assigneeId: 4 })).rejects.toThrow(/members/);
    await expect(addMeetingTask(1, "m1", { ...input, title: " " })).rejects.toThrow("Give the task a title.");
    expect((await getMeetingSession(1, "m1"))?.tasks).toEqual([]);
  });

  it("is for those who are there, while it's live", async () => {
    await expect(addMeetingTask(2, "m1", input)).rejects.toThrow("Mark yourself present to add tasks.");
    await finishMeeting(1, "m1");
    await expect(addMeetingTask(1, "m1", input)).rejects.toThrow("This meeting has finished.");
  });

  it("leaves the task in the circle's backlog when the meeting's event is gone", async () => {
    const { task } = await addMeetingTask(1, "m1", input);
    await db.execute(sql`delete from event_rsvps where event_id = 'm1'`);
    await db.execute(sql`delete from events where id = 'm1'`);
    const { rows } = await db.execute<{ meeting_event_id: string | null }>(sql`select meeting_event_id from circle_tasks where id = ${task.id}`);
    expect(rows).toEqual([{ meeting_event_id: null }]);
  });
});

describe("notes", () => {
  beforeEach(async () => {
    await startMeeting(1, "m1", during);
  });

  it("are written by those who are there while it's live, and record the editor", async () => {
    await expect(saveTopicNotes(2, "m1", 0, "hi")).rejects.toThrow("Mark yourself present to take notes.");
    const s = await saveTopicNotes(1, "m1", 1, "Decided: **yes**");
    expect(s.topics[1]?.notes).toBe("Decided: **yes**");
    expect(s.minutesEditedBy).toBe(1);
    expect(s.minutesEditedAt).toBeDefined();
  });

  it("replace what was there", async () => {
    await saveTopicNotes(1, "m1", 0, "first");
    expect((await saveTopicNotes(1, "m1", 0, "second")).topics[0]?.notes).toBe("second");
  });

  it("refuse a missing topic and an over-long note", async () => {
    await expect(saveTopicNotes(1, "m1", 9, "x")).rejects.toThrow("There's no such topic.");
    await expect(saveTopicNotes(1, "m1", 0, "x".repeat(20_001))).rejects.toThrow(/up to 20,000/);
  });

  it("can be corrected by any member once the meeting has finished", async () => {
    await saveTopicNotes(1, "m1", 0, "first");
    await finishMeeting(1, "m1");
    const s = await saveTopicNotes(2, "m1", 0, "corrected");
    expect(s.topics[0]?.notes).toBe("corrected");
    expect(s.minutesEditedBy).toBe(2);
    await expect(saveTopicNotes(4, "m1", 0, "no")).rejects.toThrow("That meeting doesn't exist.");
  });
});

describe("correcting the minutes", () => {
  beforeEach(async () => {
    await startMeeting(1, "m1", during);
    await saveTopicNotes(1, "m1", 0, "first");
    await saveTopicNotes(1, "m1", 1, "second");
  });

  it("is for a meeting that has finished, not one that's going", async () => {
    await expect(saveMinutes(1, "m1", [{ position: 0, notes: "x" }])).rejects.toThrow(/once the meeting has finished/);
  });

  it("saves the topics sent as one edit by the member, and leaves the others alone", async () => {
    await finishMeeting(1, "m1");
    await saveMinutes(3, "m1", [{ position: 1, notes: "third's second" }]);
    const s = await saveMinutes(2, "m1", [{ position: 0, notes: "second's first" }]);
    expect(s.topics.map((t) => t.notes)).toEqual(["second's first", "third's second"]);
    expect(s.minutesEditedBy).toBe(2);
    expect(s.minutesEditedAt).toBeDefined();
  });

  it("counts once in the rev however many topics changed", async () => {
    await finishMeeting(1, "m1");
    const before = (await getMeetingSession(1, "m1"))!.rev;
    expect((await saveMinutes(1, "m1", [{ position: 0, notes: "a" }, { position: 1, notes: "b" }])).rev).toBe(before + 1);
  });

  it("is for the circle's members, and refuses a bad edit without saving any of it", async () => {
    await finishMeeting(1, "m1");
    await expect(saveMinutes(4, "m1", [{ position: 0, notes: "x" }])).rejects.toThrow("That meeting doesn't exist.");
    await expect(saveMinutes(1, "m1", [])).rejects.toThrow("There's nothing to save.");
    await expect(saveMinutes(1, "m1", [{ position: 0, notes: "x" }, { position: 0, notes: "y" }])).rejects.toThrow("A topic can only be edited once.");
    await expect(saveMinutes(1, "m1", [{ position: 0, notes: "changed" }, { position: 9, notes: "y" }])).rejects.toThrow("There's no such topic.");
    await expect(saveMinutes(1, "m1", [{ position: 0, notes: "x".repeat(20_001) }])).rejects.toThrow(/up to 20,000/);
    expect((await getMeetingSession(1, "m1"))?.topics.map((t) => t.notes)).toEqual(["first", "second"]);
  });
});

describe("finishing", () => {
  beforeEach(async () => {
    await startMeeting(1, "m1", during);
  });

  it("is the facilitator's alone", async () => {
    await expect(finishMeeting(2, "m1")).rejects.toThrow("Only the facilitator can do that.");
    const s = await finishMeeting(1, "m1", new Date(2026, 10, 10, 11, 30));
    expect(s.status).toBe("finished");
    expect(s.finishedAt).toBeDefined();
  });

  it("closes the steps and attendance", async () => {
    await finishMeeting(1, "m1");
    await expect(setStep(1, "m1", 1)).rejects.toThrow("This meeting has finished.");
    await expect(setPresent(1, "m1", 2, true)).rejects.toThrow("This meeting has finished.");
    await expect(takeOverFacilitator(1, "m1")).rejects.toThrow("This meeting has finished.");
    await expect(finishMeeting(1, "m1")).rejects.toThrow("This meeting has finished.");
  });

  it("is gone with its event, topics included", async () => {
    await db.execute(sql`delete from event_rsvps where event_id = 'm1'`);
    await db.execute(sql`delete from events where id = 'm1'`);
    const { rows } = await db.execute<{ n: number }>(sql`select (select count(*) from meeting_sessions)::int + (select count(*) from meeting_topic_notes)::int as n`);
    expect(rows[0]?.n).toBe(0);
  });
});

describe("a meeting no one finished", () => {
  it("is finished once its run window has closed, and its minutes stay open to correct", async () => {
    await startMeeting(1, "m1", during);
    await saveTopicNotes(1, "m1", 0, "kept");
    // it ended at 12:00; the window closes a day later
    expect(await finishLapsedMeetings(new Date(2026, 10, 11, 11, 59))).toBe(0);
    expect(await finishLapsedMeetings(new Date(2026, 10, 11, 12, 0))).toBe(1);
    const s = await getMeetingSession(1, "m1");
    expect(s).toMatchObject({ status: "finished", rev: 2 });
    expect(s?.finishedAt).toBeDefined();
    expect(await finishLapsedMeetings(new Date(2026, 10, 12))).toBe(0);
    expect((await saveMinutes(2, "m1", [{ position: 0, notes: "corrected" }])).topics[0]?.notes).toBe("corrected");
  });

  it("leaves a finished one, and one that never started, alone", async () => {
    await startMeeting(1, "m1", during);
    await finishMeeting(1, "m1", new Date(2026, 10, 10, 11, 0));
    await insertEvent(event({ id: "m2", circleId: "council", kind: "meeting", agenda: AGENDA }));
    expect(await finishLapsedMeetings(new Date(2026, 10, 20))).toBe(0);
    expect((await getMeetingSession(1, "m1"))?.finishedAt).toBe(new Date(2026, 10, 10, 11, 0).toISOString());
  });
});

describe("actions before the meeting starts", () => {
  it("are refused", async () => {
    await expect(setStep(1, "m1", 1)).rejects.toThrow("This meeting hasn't started.");
  });
});

describe("what the stream is built on", () => {
  it("lets a circle's member see a meeting before it starts, and no one else", async () => {
    expect(await memberHasMeeting(1, "m1")).toBe(true);
    expect(await memberHasMeeting(4, "m1")).toBe(false);
    expect(await memberHasMeeting(1, "nope")).toBe(false);
  });

  it("hands the hub the session, or none yet, with who may see it", async () => {
    expect(await getMeetingForFanout("m1")).toEqual({ session: null, memberIds: expect.arrayContaining([1, 2, 3]) });
    await startMeeting(1, "m1", during);
    expect((await getMeetingForFanout("m1"))?.session?.status).toBe("live");
    expect(await getMeetingForFanout("nope")).toBeNull();
  });
});
