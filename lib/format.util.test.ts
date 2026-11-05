import { describe, expect, it, vi } from "vitest";
import { fmtDateTime, fmtEditDate, fmtEventWhen, fmtNumericDate, fmtTime, hasEnded, isCalendarDay, isPastEvent, parseDay, withArticle } from "./format.util";

describe("isCalendarDay", () => {
  it("accepts real days, leap day included", () => {
    expect(isCalendarDay("2026-11-10")).toBe(true);
    expect(isCalendarDay("2028-02-29")).toBe(true);
    expect(isCalendarDay("2026-12-31")).toBe(true);
  });
  it("rejects what doesn't exist or isn't in the form", () => {
    for (const s of ["2026-02-31", "2027-02-29", "2026-00-10", "2026-13-01", "2026-11-00", "2026-1-1", "11/10/2026", "", "2026-11-10T00:00"]) expect(isCalendarDay(s), s).toBe(false);
  });
});

describe("fmtTime", () => {
  it("12-hour with am/pm, dropping :00", () => {
    expect(fmtTime("00:00")).toBe("12am");
    expect(fmtTime("00:05")).toBe("12:05am");
    expect(fmtTime("09:30")).toBe("9:30am");
    expect(fmtTime("12:00")).toBe("12pm");
    expect(fmtTime("12:45")).toBe("12:45pm");
    expect(fmtTime("18:00")).toBe("6pm");
    expect(fmtTime("23:59")).toBe("11:59pm");
  });
});

describe("fmtEventWhen", () => {
  it("day and times", () => expect(fmtEventWhen({ date: "2026-11-10", start: "18:00", end: "20:30" })).toBe("Tue, Nov 10 · 6pm–8:30pm"));
  it("just the times for a date that can't be read", () => expect(fmtEventWhen({ date: "", start: "18:00", end: "20:00" })).toBe("6pm–8pm"));
});

describe("isPastEvent / hasEnded", () => {
  it("is past once its day is before today; today and undated are not", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 10, 15, 0));
    try {
      expect(isPastEvent({ date: "2026-11-09" })).toBe(true);
      expect(isPastEvent({ date: "2026-11-10" })).toBe(false);
      expect(isPastEvent({ date: "2026-11-11" })).toBe(false);
      expect(isPastEvent({ date: "" })).toBe(false);
      expect(isPastEvent({ date: "garbage" })).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
  it("hasEnded: by end time, overnight aware, falling back to the day without a clock", () => {
    const e = { date: "2026-11-10", start: "10:00", end: "12:00" };
    expect(hasEnded(e, new Date(2026, 10, 10, 11, 59).getTime())).toBe(false);
    expect(hasEnded(e, new Date(2026, 10, 10, 12, 0).getTime())).toBe(true);
    const night = { date: "2026-11-10", start: "22:00", end: "01:00" };
    expect(hasEnded(night, new Date(2026, 10, 11, 0, 30).getTime())).toBe(false);
    expect(hasEnded(night, new Date(2026, 10, 11, 1, 0).getTime())).toBe(true);
  });
});

describe("misc formatting", () => {
  it("withArticle", () => {
    expect(withArticle("Leader")).toBe("a Leader");
    expect(withArticle("Attendee")).toBe("an Attendee");
    expect(withArticle(" Usher")).toBe("an  Usher");
  });
  it("parseDay is local midnight", () => expect(parseDay("2026-11-10")).toEqual(new Date(2026, 10, 10)));
  it("fmtDateTime", () => expect(fmtDateTime(new Date(2026, 10, 7, 15, 0))).toBe("Sat, Nov 7 at 3pm"));
  it("fmtEditDate / fmtNumericDate, empty for a bad timestamp", () => {
    const iso = new Date(2026, 5, 29, 12).toISOString();
    expect(fmtEditDate(iso)).toBe("Jun 29, 2026");
    expect(fmtNumericDate(iso)).toBe("6/29/2026");
    expect(fmtEditDate("nope")).toBe("");
    expect(fmtNumericDate("nope")).toBe("");
  });
});
