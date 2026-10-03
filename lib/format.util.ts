import type { Event } from "./types";

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// iso is always a well-formed "YYYY-MM-DD" day string (this app's own
// internal format, not user input to validate), so the split always yields
// all three parts.
export function parseDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}
// an event is "past" once its day is before today. events with no set date
// (e.g. a just-convened council, date TBD) are never past.
export function isPastEvent(e: Pick<Event, "date">): boolean {
  if (!e.date) return false;
  const d = parseDay(e.date);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}
// t is always a well-formed "HH:MM" time string (this app's own internal
// format), so the split always yields both parts.
export function fmtTime(t: string): string {
  const [h, m] = t.split(":").map(Number) as [number, number];
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, "0")}${ampm}`;
}
// an event's day and times, "Thu, Sep 24 · 6pm–8pm", the same shape as the
// event page's masthead (for messages sent about it: emails and pushes)
export function fmtEventWhen(d: { date: string; start: string; end: string }): string {
  const day = parseDay(d.date);
  const time = `${fmtTime(d.start)}–${fmtTime(d.end)}`;
  return isNaN(day.getTime()) ? time : `${WEEKDAYS[day.getDay()]}, ${MONTHS[day.getMonth()]} ${day.getDate()} · ${time}`;
}
// "a Leader", "an Attendee": a slot or role's name with its article, by
// whether it starts with a vowel (near enough for the names people give them)
export function withArticle(label: string): string {
  return `${/^[aeiou]/i.test(label.trim()) ? "an" : "a"} ${label}`;
}
// a moment as "Sat, Oct 5 at 3pm", in this machine's time — a proposal's
// deadline, say
export function fmtDateTime(d: Date): string {
  const time = fmtTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()} at ${time}`;
}
// compact "edited" date like "Jun 29, 2026" from an ISO timestamp
export function fmtEditDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
// numeric date like "2/24/2026" from an ISO timestamp
export function fmtNumericDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}
