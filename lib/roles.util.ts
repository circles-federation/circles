import type { Event, Role } from "./types";

/* role-based RSVP slots. an event may define `roles` (e.g. shift lead,
   librarian); each has a minimum. a shift auto-cancels when any required
   role (min >= 1) is unfilled below its minimum. */
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
/* Slotted-event lifecycle around cancellation:
   - more than 1 hour before start, an unfilled required slot is a neutral
     "needs slots" warning — there's still time to fill it.
   - from 1 hour before start until the end time, an unfilled required slot
     means the event is CANCELLED. anyone can still take a slot right up to the
     end time, which flips it back to running.
   - after the end time it's simply over.
   (In production, any scheduled<->cancelled flip emails everyone RSVP'd and all
   members of the hosting circle.) */
export const CANCEL_WINDOW_MS = 60 * 60 * 1000; // one hour before start
export function shiftEnded(e: Event): boolean {
  const end = eventDateTime(e, e.end);
  return end != null && Date.now() > end.getTime();
}
// in the final hour-before-start-through-end window
export function inCancelWindow(e: Event): boolean {
  const start = eventDateTime(e, e.start);
  const end = eventDateTime(e, e.end);
  if (!start || !end) return false;
  const now = Date.now();
  return now >= start.getTime() - CANCEL_WINDOW_MS && now <= end.getTime();
}
// hard cancelled: a required slot is unfilled inside the cancel window
export function shiftCancelled(e: Event): boolean {
  return hasUnmetRole(e) && inCancelWindow(e);
}
// neutral pre-window warning: a required slot is unfilled but there's still time
export function shiftNeedsSlots(e: Event): boolean {
  return hasUnmetRole(e) && !inCancelWindow(e) && !shiftEnded(e);
}
