import { AGENDA_CATEGORY } from "./agenda.util";
import type { Event } from "./types";

/* An event as a calendar file (iCalendar, .ics), for "Add to calendar". An
   event's date and times are the community's local time with no zone of
   their own, so they're converted to UTC here in the community's zone (`tz`,
   an IANA name) — UTC times need no VTIMEZONE block, which calendar apps
   handle unevenly. It's a one-off copy: a later edit or cancellation doesn't
   reach it. */

// the UTC instant of a wall-clock time in `tz`, DST included
function zonedToUtc(date: string, time: string, tz: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y!, mo! - 1, d!, h!, mi!);
  const offsetAt = (instant: number) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
        .formatToParts(new Date(instant))
        .map((p) => [p.type, Number(p.value)])
    );
    return Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour!, parts.minute!, parts.second!) - instant;
  };
  // twice, in case the first guess landed across a DST change from the answer
  const first = guess - offsetAt(guess);
  return new Date(guess - offsetAt(first));
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// commas, semicolons, backslashes and line breaks are special in a text value
const text = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// lines longer than 75 bytes are folded, continuing on a line that starts with a space
function fold(line: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = "";
  for (const ch of line) {
    if (encoder.encode(current + ch).length > (out.length === 0 ? 75 : 74)) {
      out.push(current);
      current = "";
    }
    current += ch;
  }
  out.push(current);
  return out.join("\r\n ");
}

export function eventCalendarFile(e: Event, { tz, url }: { tz: string; url: string }): string {
  const start = zonedToUtc(e.date, e.start, tz);
  let end = zonedToUtc(e.date, e.end, tz);
  // an end at or before the start runs past midnight
  if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  const body = e.agenda && e.agenda.length > 0
    ? `Agenda:\n${e.agenda.map((a, i) => `${i + 1}. [${AGENDA_CATEGORY[a.category].letter}] ${AGENDA_CATEGORY[a.category].label}: ${a.title}`).join("\n")}`
    : e.description.trim();
  const description = [body, `On Circles: ${url}`].filter(Boolean).join("\n\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Circles//Circles//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.id}@circles`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${text(e.title)}`,
    `LOCATION:${text(e.location)}`,
    `DESCRIPTION:${text(description)}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

// a safe file name from the event's title
export function calendarFileName(e: Pick<Event, "title">): string {
  const slug = e.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60).replace(/^-|-$/g, "");
  return `${slug || "event"}.ics`;
}
