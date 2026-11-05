import { describe, expect, it } from "vitest";
import { calendarFileName, eventCalendarFile } from "./calendar.util";
import { event } from "./test/factories";

const ics = (over = {}, tz = "America/New_York") => eventCalendarFile(event(over), { tz, url: "https://circles.example/events/e1" });
const field = (file: string, name: string) => file.split("\r\n").find((l) => l.startsWith(`${name}:`));

describe("eventCalendarFile", () => {
  it("is a VCALENDAR with CRLF line endings", () => {
    const file = ics();
    expect(file.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(file.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(file.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });
  it("converts wall-clock time to UTC in the community's zone (EST, UTC-5)", () => {
    const file = ics({ date: "2026-11-10", start: "10:00", end: "12:00" });
    expect(field(file, "DTSTART")).toBe("DTSTART:20261110T150000Z");
    expect(field(file, "DTEND")).toBe("DTEND:20261110T170000Z");
  });
  it("uses daylight time in summer (EDT, UTC-4)", () => {
    expect(field(ics({ date: "2026-07-04", start: "10:00", end: "11:00" }), "DTSTART")).toBe("DTSTART:20260704T140000Z");
  });
  it("gets the right offset on both sides of a DST change (2026-11-01 01:00 EDT → EST)", () => {
    expect(field(ics({ date: "2026-10-31", start: "20:00", end: "21:00" }), "DTSTART")).toBe("DTSTART:20261101T000000Z"); // EDT
    expect(field(ics({ date: "2026-11-01", start: "20:00", end: "21:00" }), "DTSTART")).toBe("DTSTART:20261102T010000Z"); // EST
  });
  it("handles other zones", () => {
    expect(field(ics({ date: "2026-11-10", start: "10:00", end: "11:00" }, "UTC"), "DTSTART")).toBe("DTSTART:20261110T100000Z");
    expect(field(ics({ date: "2026-11-10", start: "10:00", end: "11:00" }, "America/Los_Angeles"), "DTSTART")).toBe("DTSTART:20261110T180000Z");
  });
  it("an event past midnight ends the next day", () => {
    const file = ics({ date: "2026-11-10", start: "22:00", end: "01:00" });
    expect(field(file, "DTSTART")).toBe("DTSTART:20261111T030000Z");
    expect(field(file, "DTEND")).toBe("DTEND:20261111T060000Z");
  });
  it("has a stable UID, the URL, and an alert an hour before", () => {
    const file = ics();
    expect(field(file, "UID")).toBe("UID:e1@circles");
    expect(field(file, "URL")).toBe("URL:https://circles.example/events/e1");
    expect(file).toContain("BEGIN:VALARM");
    expect(file).toContain("TRIGGER:-PT1H");
  });
  it("escapes text values so a title can't add properties", () => {
    const file = ics({ title: "Soup, bread; and\nmore\\", location: "A\r\nATTENDEE:evil" });
    expect(field(file, "SUMMARY")).toBe("SUMMARY:Soup\\, bread\\; and\\nmore\\\\");
    expect(field(file, "LOCATION")).toBe("LOCATION:A\\nATTENDEE:evil");
    expect(file).not.toMatch(/\r\nATTENDEE:/);
  });
  it("folds long lines at 75 bytes without splitting a multibyte character", () => {
    const file = ics({ description: "é".repeat(100) });
    const encoder = new TextEncoder();
    for (const line of file.split("\r\n")) expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    const unfolded = file.replace(/\r\n /g, "");
    expect(unfolded).toContain("é".repeat(100));
  });
  it("lists a meeting's agenda in place of its description", () => {
    const file = ics({ kind: "meeting", description: "", agenda: [{ category: "decide", title: "Budget" }, { category: "report", title: "News" }] });
    const unfolded = file.replace(/\r\n /g, "");
    expect(unfolded).toContain("Agenda:\\n1. [D] Decide: Budget\\n2. [R] Report: News");
  });
});

describe("calendarFileName", () => {
  it("slugs the title", () => expect(calendarFileName({ title: "Soup & Bread Night!" })).toBe("soup-bread-night.ics"));
  it("falls back for a title with nothing usable", () => expect(calendarFileName({ title: "!!!" })).toBe("event.ics"));
  it("caps the length", () => expect(calendarFileName({ title: "a".repeat(200) }).length).toBeLessThanOrEqual(64));
  it("can't escape the directory", () => expect(calendarFileName({ title: "../../etc/passwd" })).toBe("etc-passwd.ics"));
});
