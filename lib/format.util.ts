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
// compact "edited" date like "Jun 29, 2026" from an ISO timestamp
export function fmtEditDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
