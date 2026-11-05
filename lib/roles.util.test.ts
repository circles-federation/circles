import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTO_CANCEL_MS, SLOT_WARNING_MS, autoCancelAt, autoCancelClock, eventDateTime, hasUnmetRole, roleFull, roleUnmet, shiftAtRisk, shiftEnded, shiftNeedsSlots, unmetRoleLabels } from "./roles.util";
import { event } from "./test/factories";
import type { Role } from "./types";

const role = (over: Partial<Role> = {}): Role => ({ key: "r", label: "Lead", min: 1, members: [], ...over });
// the event starts at 10:00 and ends at 12:00 on 2026-11-10
const shift = (roles: Role[], over = {}) => event({ roles, ...over });
const at = (h: number, m = 0) => vi.setSystemTime(new Date(2026, 10, 10, h, m));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("role slots", () => {
  it("unmet only when required and short", () => {
    expect(roleUnmet(role({ min: 0 }))).toBe(false);
    expect(roleUnmet(role({ min: 2, members: [1] }))).toBe(true);
    expect(roleUnmet(role({ min: 2, members: [1, 2] }))).toBe(false);
  });
  it("full only with a max, once reached", () => {
    expect(roleFull(role({ members: [1, 2, 3] }))).toBe(false);
    expect(roleFull(role({ max: 2, members: [1] }))).toBe(false);
    expect(roleFull(role({ max: 2, members: [1, 2] }))).toBe(true);
  });
  it("hasUnmetRole and unmetRoleLabels look at required slots only", () => {
    const e = shift([role({ label: "A", min: 1 }), role({ label: "B", min: 0 }), role({ label: "C", min: 1, members: [1] })]);
    expect(hasUnmetRole(e)).toBe(true);
    expect(unmetRoleLabels(e)).toEqual(["A"]);
    expect(hasUnmetRole(event())).toBe(false);
    expect(unmetRoleLabels(event())).toEqual([]);
  });
});

describe("eventDateTime", () => {
  it("reads the date and a clock", () => {
    expect(eventDateTime(event(), "10:30")).toEqual(new Date(2026, 10, 10, 10, 30));
  });
  it("is null with no date or time", () => {
    expect(eventDateTime(event({ date: "" }), "10:00")).toBeNull();
    expect(eventDateTime(event(), "")).toBeNull();
  });
});

describe("a short slot's lifecycle", () => {
  const short = shift([role()]);

  it("needs slots with more than an hour to go", () => {
    at(8, 59);
    expect(shiftNeedsSlots(short)).toBe(true);
    expect(shiftAtRisk(short)).toBe(false);
  });
  it("is at risk from exactly an hour before", () => {
    at(9, 0);
    expect(shiftNeedsSlots(short)).toBe(false);
    expect(shiftAtRisk(short)).toBe(true);
  });
  it("stays at risk while under way, and not once ended", () => {
    at(11, 0);
    expect(shiftAtRisk(short)).toBe(true);
    at(12, 1);
    expect(shiftEnded(short)).toBe(true);
    expect(shiftAtRisk(short)).toBe(false);
  });
  it("neither, once the slot is filled", () => {
    const filled = shift([role({ members: [1] })]);
    at(9, 30);
    expect(shiftAtRisk(filled)).toBe(false);
    expect(shiftNeedsSlots(filled)).toBe(false);
  });
  it("neither, for a cancelled event", () => {
    const cancelled = shift([role()], { cancelled: true });
    at(9, 30);
    expect(shiftAtRisk(cancelled)).toBe(false);
    at(8, 0);
    expect(shiftNeedsSlots(cancelled)).toBe(false);
  });
  it("uses the thresholds the docs give", () => {
    expect(SLOT_WARNING_MS).toBe(60 * 60 * 1000);
    expect(AUTO_CANCEL_MS).toBe(15 * 60 * 1000);
  });
});

describe("automatic cancellation", () => {
  it("is 15 minutes before the start", () => {
    expect(autoCancelAt(event())).toEqual(new Date(2026, 10, 10, 9, 45));
  });
  it("never, for one created or moved inside the hour", () => {
    expect(autoCancelAt(event({ noAutoCancel: true }))).toBeNull();
  });
  it("autoCancelClock reads the time for a start", () => {
    expect(autoCancelClock("10:00")).toBe("9:45am");
    expect(autoCancelClock("18:10")).toBe("5:55pm");
  });
  it("autoCancelClock wraps past midnight", () => {
    expect(autoCancelClock("00:10")).toBe("11:55pm");
  });
});
