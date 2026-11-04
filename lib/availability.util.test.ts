import { describe, expect, it } from "vitest";
import {
  AVAILABILITY_PRESETS,
  availabilityFor,
  clockMinutes,
  dayRanges,
  fieldMinutes,
  hasPreset,
  minutesClock,
  normalizeAvailability,
  sameAvailability,
  validateAvailability,
} from "./availability.util";
import type { AvailabilityWindow } from "./types";

const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const win = (days: number[], start: number, end: number): AvailabilityWindow => ({ days, start, end });

describe("clock conversions", () => {
  it("round-trip", () => {
    expect(clockMinutes("18:30")).toBe(1110);
    expect(minutesClock(1110)).toBe("18:30");
  });
  it("the end of the day reads 00:00", () => {
    expect(minutesClock(1440)).toBe("00:00");
  });
  it("fieldMinutes snaps to the quarter hour; an end at midnight is the day's end", () => {
    expect(fieldMinutes("18:07", false)).toBe(h(18));
    expect(fieldMinutes("18:08", false)).toBe(h(18, 15));
    expect(fieldMinutes("00:00", false)).toBe(0);
    expect(fieldMinutes("00:00", true)).toBe(1440);
    expect(fieldMinutes("23:59", true)).toBe(1440);
  });
});

describe("validateAvailability", () => {
  it("accepts an empty schedule and a good one", () => {
    expect(validateAvailability([])).toBeNull();
    expect(validateAvailability([win([1, 2], h(18), h(21))])).toBeNull();
    expect(validateAvailability([win([0], 0, 1440)])).toBeNull();
  });
  it("refuses a window with no days, or bad days", () => {
    expect(validateAvailability([win([], 600, 700)])).toMatch(/at least one day/);
    expect(validateAvailability([win([1, 1], 600, 700)])).toMatch(/days of the week/);
    expect(validateAvailability([win([7], 600, 700)])).toMatch(/days of the week/);
    expect(validateAvailability([win([1.5], 600, 700)])).toMatch(/days of the week/);
  });
  it("needs quarter-hour times inside a day, ending after they start", () => {
    expect(validateAvailability([win([1], 605, 700)])).toMatch(/quarter hour/);
    expect(validateAvailability([win([1], -15, 60)])).toMatch(/within a day/);
    expect(validateAvailability([win([1], 600, 1455)])).toMatch(/quarter hour|within a day/);
    expect(validateAvailability([win([1], 600, 600)])).toMatch(/end after/);
    expect(validateAvailability([win([1], 720, 600)])).toMatch(/end after/);
  });
  it("limits how many windows", () => {
    const many = Array.from({ length: 15 }, () => win([1], 600, 660));
    expect(validateAvailability(many)).toMatch(/14/);
  });
  it("allows overlapping windows", () => {
    expect(validateAvailability([win([1], 600, 720), win([1], 660, 780)])).toBeNull();
  });
});

describe("dayRanges", () => {
  it("joins touching and overlapping ranges, sorted", () => {
    const w = [win([1], 780, 840), win([1], 600, 660), win([1], 660, 720), win([1], 700, 760), win([2], 0, 60)];
    expect(dayRanges(w, 1)).toEqual([{ start: 600, end: 760 }, { start: 780, end: 840 }]);
    expect(dayRanges(w, 3)).toEqual([]);
  });
  it("doesn't mutate its input", () => {
    const w = [win([1], 600, 660), win([1], 660, 720)];
    dayRanges(w, 1);
    expect(w).toEqual([win([1], 600, 660), win([1], 660, 720)]);
  });
});

describe("normalizeAvailability", () => {
  it("groups days with the same range, in time order", () => {
    expect(normalizeAvailability([win([3], 600, 660), win([1], 600, 660), win([1], 300, 400)])).toEqual([win([1], 300, 400), win([1, 3], 600, 660)]);
  });
  it("merges overlaps into one", () => {
    expect(normalizeAvailability([win([1], 600, 720), win([1], 660, 780)])).toEqual([win([1], 600, 780)]);
  });
  it("is idempotent, and empty stays empty", () => {
    const once = normalizeAvailability([win([2, 1], 600, 720), win([1], 700, 800)]);
    expect(normalizeAvailability(once)).toEqual(once);
    expect(normalizeAvailability([])).toEqual([]);
  });
  it("sameAvailability compares the normalized forms", () => {
    expect(sameAvailability([win([1, 2], 600, 660)], [win([2], 600, 660), win([1], 600, 630), win([1], 630, 660)])).toBe(true);
    expect(sameAvailability([win([1], 600, 660)], [win([1], 600, 675)])).toBe(false);
  });
});

describe("presets", () => {
  const evenings = AVAILABILITY_PRESETS.find((p) => p.key === "weekday-evenings")!;
  it("hasPreset matches an exact window regardless of day order", () => {
    expect(hasPreset([win([5, 4, 3, 2, 1], h(18), h(21))], evenings)).toBe(true);
    expect(hasPreset([win([1, 2, 3, 4], h(18), h(21))], evenings)).toBe(false);
    expect(hasPreset([win([1, 2, 3, 4, 5], h(18), h(22))], evenings)).toBe(false);
  });
});

describe("availabilityFor", () => {
  // 2026-11-10 is a Tuesday (day 2)
  const tuesdays = [win([2], h(18), h(21))];
  it("unknown for a schedule never set", () => {
    expect(availabilityFor(null, "2026-11-10", "18:00", "19:00")).toEqual({ status: "unknown" });
  });
  it("not available for a schedule of nothing, which is not unknown", () => {
    expect(availabilityFor([], "2026-11-10", "18:00", "19:00")).toEqual({ status: "unavailable" });
  });
  it("available when one range covers all of it, edges included", () => {
    expect(availabilityFor(tuesdays, "2026-11-10", "18:00", "21:00")).toEqual({ status: "available" });
    expect(availabilityFor(tuesdays, "2026-11-10", "19:00", "20:00")).toEqual({ status: "available" });
  });
  it("not available on another day", () => {
    expect(availabilityFor(tuesdays, "2026-11-11", "19:00", "20:00")).toEqual({ status: "unavailable" });
  });
  it("free as it begins but not through the end gives freeUntil", () => {
    expect(availabilityFor(tuesdays, "2026-11-10", "20:00", "22:00")).toEqual({ status: "unavailable", freeUntil: h(21) });
  });
  it("not free at all when it starts before the window", () => {
    expect(availabilityFor(tuesdays, "2026-11-10", "17:00", "19:00")).toEqual({ status: "unavailable" });
  });
  it("starting exactly when the range ends isn't free as it begins", () => {
    expect(availabilityFor(tuesdays, "2026-11-10", "21:00", "22:00")).toEqual({ status: "unavailable" });
  });
  it("two ranges in a day don't cover a span across the gap", () => {
    const split = [win([2], h(9), h(11)), win([2], h(13), h(15))];
    expect(availabilityFor(split, "2026-11-10", "10:00", "14:00")).toEqual({ status: "unavailable", freeUntil: h(11) });
  });
  it("touching windows count as one", () => {
    const touching = [win([2], h(9), h(11)), win([2], h(11), h(13))];
    expect(availabilityFor(touching, "2026-11-10", "10:00", "12:00")).toEqual({ status: "available" });
  });
  it("an end at or before the start isn't available (a meeting past midnight isn't checked)", () => {
    expect(availabilityFor(tuesdays, "2026-11-10", "20:00", "01:00")).toEqual({ status: "unavailable" });
  });
});
