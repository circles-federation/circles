import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  attendeeIds,
  availableReminders,
  defaultEventTimes,
  defaultReminders,
  endAfterStartMoves,
  eventEndsAt,
  eventStartsAt,
  hasEnded,
  isAttending,
  isClock,
  isDay,
  isMyEvent,
  meetingLink,
  normalizeReminders,
  remindersSummary,
  remindersWithin,
  roleKey,
  validateEventDraft,
  type EventDraft,
} from "./events.util";
import { event } from "./test/factories";

// "now" for every test: Tue 2026-11-10 09:00 local
const NOW = new Date(2026, 10, 10, 9, 0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

const draft = (over: Partial<EventDraft> = {}): EventDraft => ({
  title: "Coffee",
  kind: "ordinary",
  circleId: "city",
  date: "2026-11-10",
  start: "10:00",
  end: "11:00",
  location: "The park",
  description: "",
  ...over,
});

describe("isDay / isClock", () => {
  it("accepts well-formed values", () => {
    expect(isDay("2026-11-10")).toBe(true);
    expect(isClock("00:00")).toBe(true);
    expect(isClock("23:59")).toBe(true);
  });
  it("rejects malformed values", () => {
    expect(isDay("2026-13-01")).toBe(false);
    expect(isDay("11/10/2026")).toBe(false);
    expect(isDay("")).toBe(false);
  });
  it("rejects a day that doesn't exist, which JavaScript would roll into the next month", () => {
    expect(isDay("2026-02-31")).toBe(false);
    expect(isDay("2026-04-31")).toBe(false);
    expect(isDay("2027-02-29")).toBe(false);
    expect(isDay("2028-02-29")).toBe(true);
    expect(validateEventDraft(draft({ date: "2026-11-31" }))).toMatch(/date/);
    expect(validateEventDraft(draft({ repeat: { frequency: "weekly", until: "2027-02-30" } }))).toMatch(/after the first/);
  });
  it("(malformed)", () => {
    expect(isClock("24:00")).toBe(false);
    expect(isClock("9:00")).toBe(false);
    expect(isClock("10:60")).toBe(false);
  });
});

describe("validateEventDraft", () => {
  it("passes a valid draft", () => {
    expect(validateEventDraft(draft())).toBeNull();
  });

  it("requires a title, within the limit", () => {
    expect(validateEventDraft(draft({ title: "  " }))).toMatch(/title/);
    expect(validateEventDraft(draft({ title: "x".repeat(121) }))).toMatch(/120/);
    expect(validateEventDraft(draft({ title: "x".repeat(120) }))).toBeNull();
  });

  it("says meeting for a meeting", () => {
    expect(validateEventDraft(draft({ kind: "meeting", title: "" }))).toMatch(/meeting/);
  });

  it("rejects an unknown kind and a missing circle", () => {
    expect(validateEventDraft(draft({ kind: "council" as never }))).toMatch(/event or meeting/);
    expect(validateEventDraft(draft({ circleId: "" }))).toMatch(/circle/);
  });

  it("rejects a bad date and a date before today", () => {
    expect(validateEventDraft(draft({ date: "nope" }))).toMatch(/date/);
    expect(validateEventDraft(draft({ date: "2026-11-09" }))).toMatch(/today or a later/);
  });

  it("allows today, and an edit already under way", () => {
    expect(validateEventDraft(draft({ start: "08:00", end: "10:00" }))).toBeNull();
  });

  it("when creating, refuses a start that has passed (or is exactly now)", () => {
    expect(validateEventDraft(draft({ start: "08:59", end: "10:00" }), { creating: true })).toMatch(/passed/);
    expect(validateEventDraft(draft({ start: "09:00", end: "10:00" }), { creating: true })).toMatch(/passed/);
    expect(validateEventDraft(draft({ start: "09:01", end: "10:00" }), { creating: true })).toBeNull();
  });

  it("uses the injected now when creating", () => {
    const later = new Date(2026, 10, 10, 9, 30);
    expect(validateEventDraft(draft({ start: "09:15", end: "10:00" }), { creating: true, now: later })).toMatch(/passed/);
  });

  it("requires valid times and a location within the limit", () => {
    expect(validateEventDraft(draft({ start: "" }))).toMatch(/start and end/);
    expect(validateEventDraft(draft({ end: "25:00" }))).toMatch(/start and end/);
    expect(validateEventDraft(draft({ location: " " }))).toMatch(/location/);
    expect(validateEventDraft(draft({ location: "x".repeat(201) }))).toMatch(/200/);
  });

  it("limits the description", () => {
    expect(validateEventDraft(draft({ description: "x".repeat(5001) }))).toMatch(/too long/);
    expect(validateEventDraft(draft({ description: "x".repeat(5000) }))).toBeNull();
  });

  describe("agenda", () => {
    const item = { category: "decide" as const, title: "Budget" };
    it("a meeting needs one", () => {
      expect(validateEventDraft(draft({ kind: "meeting" }))).toMatch(/agenda topic/);
      expect(validateEventDraft(draft({ kind: "meeting", agenda: [item] }))).toBeNull();
    });
    it("an ordinary event can't have one", () => {
      expect(validateEventDraft(draft({ agenda: [item] }))).toMatch(/Only a meeting/);
      expect(validateEventDraft(draft({ agenda: [] }))).toBeNull();
    });
  });

  it("a meeting can't be circle-hosted, repeat, or have roles", () => {
    const agenda = [{ category: "report" as const, title: "News" }];
    const meeting = { kind: "meeting" as const, agenda };
    expect(validateEventDraft(draft({ ...meeting, hostCircleId: "c" }))).toMatch(/proposed by you/);
    expect(validateEventDraft(draft({ ...meeting, repeat: { frequency: "weekly" } }))).toMatch(/can't repeat/);
    expect(validateEventDraft(draft({ ...meeting, roles: [{ label: "Lead", min: 1 }] }))).toMatch(/signup roles/);
  });

  describe("repeat", () => {
    it("needs a known frequency", () => {
      expect(validateEventDraft(draft({ repeat: { frequency: "daily" as never } }))).toMatch(/how often/);
      expect(validateEventDraft(draft({ repeat: { frequency: "weekly" } }))).toBeNull();
    });
    it("until must be a date after the first", () => {
      expect(validateEventDraft(draft({ repeat: { frequency: "weekly", until: "2026-11-10" } }))).toMatch(/after the first/);
      expect(validateEventDraft(draft({ repeat: { frequency: "weekly", until: "soon" } }))).toMatch(/after the first/);
      expect(validateEventDraft(draft({ repeat: { frequency: "weekly", until: "2026-11-11" } }))).toBeNull();
    });
  });

  describe("reminders", () => {
    it("accepts the offered hours, in any order and none", () => {
      expect(validateEventDraft(draft({ reminders: [1, 24] }))).toBeNull();
      expect(validateEventDraft(draft({ reminders: [] }))).toBeNull();
    });
    it("rejects anything else", () => {
      expect(validateEventDraft(draft({ reminders: [5 as never] }))).toMatch(/remind/);
    });
  });

  describe("roles", () => {
    it("accepts valid roles", () => {
      expect(validateEventDraft(draft({ roles: [{ label: "Lead", min: 1, max: 2 }, { label: "Helper", min: 0 }] }))).toBeNull();
    });
    it("needs a name, within the limit", () => {
      expect(validateEventDraft(draft({ roles: [{ label: " ", min: 1 }] }))).toMatch(/name/);
      expect(validateEventDraft(draft({ roles: [{ label: "x".repeat(61), min: 1 }] }))).toMatch(/60/);
    });
    it("checks min and max", () => {
      expect(validateEventDraft(draft({ roles: [{ label: "A", min: -1 }] }))).toMatch(/minimum/);
      expect(validateEventDraft(draft({ roles: [{ label: "A", min: 1.5 }] }))).toMatch(/minimum/);
      expect(validateEventDraft(draft({ roles: [{ label: "A", min: 3, max: 2 }] }))).toMatch(/max/);
      expect(validateEventDraft(draft({ roles: [{ label: "A", min: 0, max: 0 }] }))).toMatch(/max/);
      expect(validateEventDraft(draft({ roles: [{ label: "A", min: 2, max: 2 }] }))).toBeNull();
    });
    it("refuses names that slug to the same key", () => {
      expect(validateEventDraft(draft({ roles: [{ label: "Set up", min: 0 }, { label: "set-up", min: 0 }] }))).toMatch(/Two roles/);
    });
    it("limits how many", () => {
      const many = Array.from({ length: 21 }, (_, i) => ({ label: `Role ${i}`, min: 0 }));
      expect(validateEventDraft(draft({ roles: many }))).toMatch(/20/);
    });
  });
});

describe("roleKey", () => {
  it("slugs the label", () => {
    expect(roleKey("  Set Up & Tear-down ", 0)).toBe("set-up-tear-down");
  });
  it("falls back to the position for a label with no letters or digits", () => {
    expect(roleKey("!!!", 3)).toBe("slot-3");
  });
});

describe("event times", () => {
  it("starts and ends on its date", () => {
    expect(eventStartsAt(event())).toEqual(new Date(2026, 10, 10, 10, 0));
    expect(eventEndsAt(event())).toEqual(new Date(2026, 10, 10, 12, 0));
  });
  it("ends the next day when the end is at or before the start", () => {
    expect(eventEndsAt(event({ start: "22:00", end: "01:00" }))).toEqual(new Date(2026, 10, 11, 1, 0));
    expect(eventEndsAt(event({ start: "10:00", end: "10:00" }))).toEqual(new Date(2026, 10, 11, 10, 0));
  });
  it("hasEnded flips exactly at the end", () => {
    const e = event();
    expect(hasEnded(e, new Date(2026, 10, 10, 11, 59))).toBe(false);
    expect(hasEnded(e, new Date(2026, 10, 10, 12, 0))).toBe(true);
  });
  it("an overnight event hasn't ended before the small hours", () => {
    const e = event({ start: "22:00", end: "01:00" });
    expect(hasEnded(e, new Date(2026, 10, 11, 0, 30))).toBe(false);
    expect(hasEnded(e, new Date(2026, 10, 11, 1, 0))).toBe(true);
  });
  it("keeps wall-clock time across the end of daylight saving (2026-11-01)", () => {
    expect(eventStartsAt(event({ date: "2026-11-01", start: "09:00" })).getHours()).toBe(9);
    // 01:30 happens twice that day; a 23:00-01:00 event still ends at 01:00
    expect(eventEndsAt(event({ date: "2026-10-31", start: "23:00", end: "01:00" })).getHours()).toBe(1);
  });
});

describe("reminders", () => {
  it("offers all of them while the date or time isn't set", () => {
    expect(availableReminders({ date: "", start: "" })).toEqual([24, 2, 1]);
  });
  it("offers those further off than the start", () => {
    // starts 10:00, now 09:00: an hour away exactly, so not even 1h
    expect(availableReminders({ date: "2026-11-10", start: "10:00" })).toEqual([]);
    expect(availableReminders({ date: "2026-11-10", start: "10:01" })).toEqual([1]);
    expect(availableReminders({ date: "2026-11-10", start: "11:30" })).toEqual([2, 1]);
    expect(availableReminders({ date: "2026-11-12", start: "09:00" })).toEqual([24, 2, 1]);
  });
  it("defaults to the longest one still to come, or none", () => {
    expect(defaultReminders([24, 2, 1])).toEqual([24]);
    expect(defaultReminders([2, 1])).toEqual([2]);
    expect(defaultReminders([1])).toEqual([1]);
    expect(defaultReminders([])).toEqual([]);
  });
  it("summarises", () => {
    expect(remindersSummary([])).toBe("None");
    expect(remindersSummary([24])).toBe("1 day before");
    expect(remindersSummary([1, 24])).toBe("1 day and 1 hour before");
    expect(remindersSummary([24, 2, 1])).toBe("1 day, 2 hours and 1 hour before");
  });
  it("normalizes to the offered hours, once each, longest first", () => {
    expect(normalizeReminders([1, 24, 1])).toEqual([24, 1]);
    expect(normalizeReminders([])).toEqual([]);
    expect(normalizeReminders([3])).toBeNull();
    expect(normalizeReminders("24")).toBeNull();
    expect(normalizeReminders(undefined)).toBeNull();
  });
  it("remindersWithin: the ones an event is already inside of", () => {
    expect(remindersWithin({ date: "2026-11-12", start: "09:00" })).toEqual([]);
    expect(remindersWithin({ date: "2026-11-11", start: "08:00" })).toEqual([24]);
    expect(remindersWithin({ date: "2026-11-10", start: "10:30" })).toEqual([24, 2]);
    expect(remindersWithin({ date: "2026-11-10", start: "09:30" })).toEqual([24, 2, 1]);
  });
  it("remindersWithin: nothing for an event that's already started", () => {
    expect(remindersWithin({ date: "2026-11-10", start: "08:00" })).toEqual([]);
  });
});

describe("defaultEventTimes", () => {
  it("starts at the next quarter hour, two hours long", () => {
    expect(defaultEventTimes(new Date(2026, 10, 10, 9, 7))).toEqual({ date: "2026-11-10", start: "09:15", end: "11:15" });
  });
  it("an exact quarter gives the next one", () => {
    expect(defaultEventTimes(new Date(2026, 10, 10, 6, 0)).start).toBe("06:15");
  });
  it("rolls to tomorrow after 11:45pm", () => {
    expect(defaultEventTimes(new Date(2026, 10, 10, 23, 50))).toEqual({ date: "2026-11-11", start: "00:00", end: "02:00" });
  });
  it("never ends past 11:59pm", () => {
    expect(defaultEventTimes(new Date(2026, 10, 10, 22, 40))).toMatchObject({ start: "22:45", end: "23:59" });
  });
});

describe("endAfterStartMoves", () => {
  it("keeps the length", () => {
    expect(endAfterStartMoves("10:00", "12:30", "14:00")).toBe("16:30");
  });
  it("falls back to an hour when the old length wasn't valid", () => {
    expect(endAfterStartMoves("10:00", "09:00", "14:00")).toBe("15:00");
    expect(endAfterStartMoves("", "", "14:00")).toBe("15:00");
  });
  it("stops at 11:59pm", () => {
    expect(endAfterStartMoves("10:00", "12:00", "23:00")).toBe("23:59");
  });
  it("leaves the end alone while the new start is half typed", () => {
    expect(endAfterStartMoves("10:00", "12:00", "1")).toBe("12:00");
  });
});

describe("meetingLink", () => {
  it("is the address for a bare web address", () => {
    expect(meetingLink("https://meet.example.org/abc")).toBe("https://meet.example.org/abc");
    expect(meetingLink("  http://example.org  ")).toBe("http://example.org/");
  });
  it("is null for a place or any other scheme", () => {
    expect(meetingLink("Join at https://example.org")).toBeNull();
    expect(meetingLink("The park")).toBeNull();
    expect(meetingLink("javascript:alert(1)")).toBeNull();
    expect(meetingLink("ftp://example.org")).toBeNull();
    expect(meetingLink("")).toBeNull();
  });
});

describe("attendance", () => {
  const slotted = event({ rsvps: [1], roles: [{ key: "a", label: "A", min: 0, members: [2, 3] }, { key: "b", label: "B", min: 0, members: [3] }] });
  it("attendeeIds merges RSVPs and slot holders once each", () => {
    expect(attendeeIds(slotted).sort()).toEqual([1, 2, 3]);
  });
  it("isAttending counts either", () => {
    expect(isAttending(slotted, 1)).toBe(true);
    expect(isAttending(slotted, 3)).toBe(true);
    expect(isAttending(slotted, 9)).toBe(false);
  });
  it("isMyEvent: going, attending or organizing", () => {
    const e = event({ organizerId: 5 });
    expect(isMyEvent(e, 5)).toBe(true);
    expect(isMyEvent(e, 6)).toBe(false);
    expect(isMyEvent(e, 6, true)).toBe(true);
  });
});
