import { describe, expect, it } from "vitest";
import { MEETING_NOTES_MAX, canRunMeeting, defaultFacilitator, lastStep, stepAt, validateNotes } from "./meeting-session.util";

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
  it("runs attendance, each topic, tasks, then the wrap-up", () => {
    expect(lastStep(2)).toBe(4);
    expect([0, 1, 2, 3, 4].map((s) => stepAt(s, 2))).toEqual([
      { kind: "attendance" },
      { kind: "topic", index: 0 },
      { kind: "topic", index: 1 },
      { kind: "tasks" },
      { kind: "wrapup" },
    ]);
  });

  it("has no step outside that", () => {
    expect(stepAt(-1, 2)).toBeNull();
    expect(stepAt(5, 2)).toBeNull();
    expect(stepAt(1.5, 2)).toBeNull();
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
