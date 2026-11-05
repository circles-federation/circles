import { describe, expect, it } from "vitest";
import { addDays, datesBetween, endedBefore, localDay, relativeDayWord, repeatLabel, repeatSummary } from "./recurrence.util";

// 2026-11-10 is the 2nd Tuesday of November
describe("addDays", () => {
  it("crosses month, year and leap-day boundaries", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
    expect(addDays("2026-11-10", -10)).toBe("2026-10-31");
  });
  it("isn't moved by the daylight-saving change on 2026-11-01", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
  });
});

describe("datesBetween weekly", () => {
  it("repeats the weekday, after `after` and through `through`", () => {
    expect(datesBetween("weekly", "2026-11-10", "2026-11-10", "2026-12-01")).toEqual(["2026-11-17", "2026-11-24", "2026-12-01"]);
  });
  it("includes the first date when `after` is before it", () => {
    expect(datesBetween("weekly", "2026-11-10", "2026-11-09", "2026-11-17")).toEqual(["2026-11-10", "2026-11-17"]);
  });
  it("stops at its own last date", () => {
    expect(datesBetween("weekly", "2026-11-10", "2026-11-09", "2026-12-31", "2026-11-24")).toEqual(["2026-11-10", "2026-11-17", "2026-11-24"]);
  });
  it("an `until` after `through` doesn't extend it", () => {
    expect(datesBetween("weekly", "2026-11-10", "2026-11-09", "2026-11-17", "2027-01-01")).toEqual(["2026-11-10", "2026-11-17"]);
  });
  it("is empty when there's nothing in range", () => {
    expect(datesBetween("weekly", "2026-11-10", "2026-12-01", "2026-12-01")).toEqual([]);
    expect(datesBetween("weekly", "2026-11-10", "2026-11-09", "2026-11-09")).toEqual([]);
  });
  it("keeps the weekday across daylight saving", () => {
    const dates = datesBetween("weekly", "2026-10-27", "2026-10-26", "2026-11-17");
    expect(dates).toEqual(["2026-10-27", "2026-11-03", "2026-11-10", "2026-11-17"]);
  });
});

describe("datesBetween monthly", () => {
  it("repeats its place in the month: the 2nd Tuesday", () => {
    expect(datesBetween("monthly", "2026-11-10", "2026-11-09", "2027-02-28")).toEqual(["2026-11-10", "2026-12-08", "2027-01-12", "2027-02-09"]);
  });
  it("the 1st of the month's weekday", () => {
    // 2026-11-03 is the 1st Tuesday
    expect(datesBetween("monthly", "2026-11-03", "2026-11-02", "2027-01-31")).toEqual(["2026-11-03", "2026-12-01", "2027-01-05"]);
  });
  it("the 29th–31st means the last such weekday (a 4-week February, a leap one)", () => {
    // 2026-10-30 is the last Friday of October
    expect(datesBetween("monthly", "2026-10-30", "2026-10-29", "2027-03-31")).toEqual(["2026-10-30", "2026-11-27", "2026-12-25", "2027-01-29", "2027-02-26", "2027-03-26"]);
    // 2028-01-31 is the last Monday; Feb 2028 has 29 days, ending on a Tuesday
    expect(datesBetween("monthly", "2028-01-31", "2028-01-30", "2028-03-31")).toEqual(["2028-01-31", "2028-02-28", "2028-03-27"]);
  });
  it("wraps the year", () => {
    const dates = datesBetween("monthly", "2026-12-08", "2026-12-07", "2027-01-31");
    expect(dates).toEqual(["2026-12-08", "2027-01-12"]);
  });
  it("honors `until`", () => {
    expect(datesBetween("monthly", "2026-11-10", "2026-11-09", "2027-12-31", "2026-12-08")).toEqual(["2026-11-10", "2026-12-08"]);
  });
});

describe("repeatLabel / repeatSummary", () => {
  it("weekly", () => expect(repeatLabel("weekly", "2026-11-10")).toBe("Every Tuesday"));
  it("monthly names the ordinal, or last", () => {
    expect(repeatLabel("monthly", "2026-11-10")).toBe("Monthly on the 2nd Tuesday");
    expect(repeatLabel("monthly", "2026-11-03")).toBe("Monthly on the 1st Tuesday");
    expect(repeatLabel("monthly", "2026-11-24")).toBe("Monthly on the 4th Tuesday");
    expect(repeatLabel("monthly", "2026-10-30")).toBe("Monthly on the last Friday");
  });
  it("falls back for a date that can't be read", () => {
    expect(repeatLabel("weekly", "")).toBe("Every week");
    expect(repeatLabel("monthly", "soon")).toBe("Every month");
  });
  it("adds its last date", () => {
    expect(repeatSummary({ frequency: "weekly", startsOn: "2026-11-10", until: "2026-12-01" })).toBe("Every Tuesday until Dec 1");
    expect(repeatSummary({ frequency: "weekly", startsOn: "2026-11-10" })).toBe("Every Tuesday");
  });
});

describe("endedBefore", () => {
  it("is true only for dates after the series' last", () => {
    expect(endedBefore({ until: "2026-11-17" }, "2026-11-24")).toBe(true);
    expect(endedBefore({ until: "2026-11-17" }, "2026-11-17")).toBe(false);
    expect(endedBefore({}, "2026-11-24")).toBe(false);
    expect(endedBefore(undefined, "2026-11-24")).toBe(false);
  });
});

describe("relativeDayWord / localDay", () => {
  it("names today, tomorrow, or the weekday", () => {
    expect(relativeDayWord("2026-11-10", "2026-11-10")).toBe("today");
    expect(relativeDayWord("2026-11-11", "2026-11-10")).toBe("tomorrow");
    expect(relativeDayWord("2026-12-01", "2026-11-10")).toBe("on Tue");
    expect(relativeDayWord("2026-12-01", undefined)).toBe("on Tue");
    expect(relativeDayWord("nonsense", "2026-11-10")).toBe("soon");
  });
  it("tomorrow works across a month end", () => {
    expect(relativeDayWord("2026-12-01", "2026-11-30")).toBe("tomorrow");
  });
  it("localDay is the local calendar day", () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(localDay(new Date(2026, 11, 31, 0, 0))).toBe("2026-12-31");
  });
});
