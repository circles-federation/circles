import { fmtTime } from "./format.util";
import type { Event, Role } from "./types";

/* role-based RSVP slots. an event may define `roles` (e.g. shift lead,
   librarian); each has a minimum. a role with min >= 1 is required, and an
   event whose required role is still short near its start is cancelled
   automatically (see the lifecycle below). */
export function hasRoles(e: Event): e is Event & { roles: Role[] } {
  return Array.isArray(e.roles) && e.roles.length > 0;
}
export function roleShort(role: Role): number {
  return role.members ? role.members.length : 0;
}
export function roleUnmet(role: Role): boolean {
  return role.min > 0 && roleShort(role) < role.min;
}
// a slot with a max is full once it reaches that many people
export function roleFull(role: Role): boolean {
  return role.max != null && roleShort(role) >= role.max;
}
// whether any required slot on the event is still unfilled
export function hasUnmetRole(e: Event): boolean {
  return hasRoles(e) && e.roles.some(roleUnmet);
}
// build a Date from the event's date + a "HH:MM" time. Both are always
// well-formed internal-format strings when present, so the splits always
// yield all their parts.
export function eventDateTime(e: Event, time: string): Date | null {
  if (!e.date || !time) return null;
  const [y, m, d] = e.date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
  return isNaN(dt.getTime()) ? null : dt;
}
/* A slotted event's lifecycle while a required slot is still short:
   - more than an hour before the start: a neutral "needs slots" note.
   - from an hour before (SLOT_WARNING_MS): at risk. Its host has been told
     (checkUnfilledSlots in lib/db/events.ts), and anyone can still sign up.
   - 15 minutes before (AUTO_CANCEL_MS), still short: cancelled, for real and
     for good, like an organizer's cancellation (Event.cancelled, with
     cancelledAutomatically), and everyone going and the host are told. One
     created or moved to within the hour (noAutoCancel) isn't: it stays at
     risk until it ends.
   The states other than cancelled are worked out from the clock on render,
   so don't cache them. */
export const SLOT_WARNING_MS = 60 * 60 * 1000;
export const AUTO_CANCEL_MS = 15 * 60 * 1000;
export function shiftEnded(e: Event): boolean {
  const end = eventDateTime(e, e.end);
  return end != null && Date.now() > end.getTime();
}
// how long until it starts (negative once it has), or null if it can't be read
function msToStart(e: Event): number | null {
  const start = eventDateTime(e, e.start);
  return start ? start.getTime() - Date.now() : null;
}
// within the hour before the start (or under way) with a required slot short
export function shiftAtRisk(e: Event): boolean {
  const ms = msToStart(e);
  return !e.cancelled && hasUnmetRole(e) && ms !== null && ms <= SLOT_WARNING_MS && !shiftEnded(e);
}
// a required slot short with more than an hour still to go
export function shiftNeedsSlots(e: Event): boolean {
  const ms = msToStart(e);
  return !e.cancelled && hasUnmetRole(e) && ms !== null && ms > SLOT_WARNING_MS;
}
// when it's cancelled if a required slot is still short, or null if it won't be
export function autoCancelAt(e: Event): Date | null {
  const start = eventDateTime(e, e.start);
  return start && !e.noAutoCancel ? new Date(start.getTime() - AUTO_CANCEL_MS) : null;
}
// "9:45am": when an event starting at a "HH:MM" `start` is cancelled for a
// short slot, for messages that only have its start
export function autoCancelClock(start: string): string {
  const [h, m] = start.split(":").map(Number) as [number, number];
  const at = (h * 60 + m - AUTO_CANCEL_MS / 60_000 + 24 * 60) % (24 * 60);
  return fmtTime(`${String(Math.floor(at / 60)).padStart(2, "0")}:${String(at % 60).padStart(2, "0")}`);
}
// the required slots still short, by name, for saying what it needs
export function unmetRoleLabels(e: Event): string[] {
  return hasRoles(e) ? e.roles.filter(roleUnmet).map((r) => r.label) : [];
}
