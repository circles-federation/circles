import { describe, expect, it } from "vitest";
import { MEETING_NOTES_MAX, canRunMeeting, defaultFacilitator, lastStep, stepAfterTopicAdded, stepAfterTopicRemoved, stepAt, stepLabel, validateNotes } from "./meeting-session.util";

const meeting = { date: "2026-11-10", start: "10:00", end: "12:00" };
const at = (h: number, m = 0, day = 10) => new Date(2026, 10, day, h, m);

describe("canRunMeeting", () => {
  it("opens at the start time and closes a day after the end", () => {
    expect(canRunMeeting(meeting, at(9, 59))).toBe(false);
    expect(canRunMeeting(meeting, at(10))).toBe(true);
    expect(canRunMeeting(meeting, at(11, 59, 11))).toBe(true);
    expect(canRunMeeting(meeting, at(12, 0, 11))).toBe(false);
  });

  it("counts a meeting that runs past midnight from its real end", () => {
    const late = { date: "2026-11-10", start: "22:00", end: "00:30" };
    expect(canRunMeeting(late, at(0, 29, 12))).toBe(true);
    expect(canRunMeeting(late, at(0, 30, 12))).toBe(false);
  });
});

describe("stepAt", () => {
  it("runs attendance, the agenda, each topic, tasks, then the wrap-up", () => {
    expect(lastStep(2)).toBe(5);
    expect([0, 1, 2, 3, 4, 5].map((s) => stepAt(s, 2))).toEqual([
      { kind: "attendance" },
      { kind: "agenda" },
      { kind: "topic", index: 0 },
      { kind: "topic", index: 1 },
      { kind: "tasks" },
      { kind: "wrapup" },
    ]);
  });

  it("has no step outside that", () => {
    expect(stepAt(-1, 2)).toBeNull();
    expect(stepAt(6, 2)).toBeNull();
    expect(stepAt(1.5, 2)).toBeNull();
  });
});

describe("stepLabel", () => {
  it("says where the meeting is in words", () => {
    expect([0, 1, 2, 3, 4, 5].map((s) => stepLabel(s, 2))).toEqual(["Attendance", "Agenda", "Topic 1 of 2", "Topic 2 of 2", "Tasks", "Wrap-up"]);
    expect(stepLabel(9, 2)).toBe("");
  });
});

describe("following the meeting when topics are added or removed", () => {
  // 3 topics: steps 0 attendance, 1 agenda, 2-4 topics, 5 tasks, 6 wrap-up
  it("moves tasks and the wrap-up a step on when a topic is added, and leaves the rest", () => {
    expect([0, 1, 2, 4, 5, 6].map((s) => stepAfterTopicAdded(s, 3))).toEqual([0, 1, 2, 4, 6, 7]);
  });

  it("moves them back when one is removed", () => {
    expect([5, 6].map((s) => stepAfterTopicRemoved(s, 3, 0))).toEqual([4, 5]);
  });

  it("keeps the topic on screen when an earlier one goes, and moves to what followed when it's the one", () => {
    expect(stepAfterTopicRemoved(4, 3, 0)).toBe(3);
    expect(stepAfterTopicRemoved(4, 3, 2)).toBe(4);
    expect(stepAfterTopicRemoved(3, 3, 2)).toBe(3);
    expect(stepAfterTopicRemoved(1, 3, 0)).toBe(1);
  });
});

describe("defaultFacilitator", () => {
  it("is the Facilitator while they're a member, else whoever started it", () => {
    expect(defaultFacilitator(3, 1, [1, 2, 3])).toBe(3);
    expect(defaultFacilitator(3, 1, [1, 2])).toBe(1);
    expect(defaultFacilitator(null, 1, [1, 2, 3])).toBe(1);
  });
});

describe("validateNotes", () => {
  it("caps the length", () => {
    expect(validateNotes("a".repeat(MEETING_NOTES_MAX))).toBeNull();
    expect(validateNotes("a".repeat(MEETING_NOTES_MAX + 1))).toMatch(/up to 20,000/);
  });
});
