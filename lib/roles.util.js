/* role-based RSVP slots. an event may define `roles` (e.g. shift lead,
   librarian); each has a minimum. a shift auto-cancels when any required
   role (min >= 1) is unfilled below its minimum. */
export function hasRoles(e) {
  return Array.isArray(e.roles) && e.roles.length > 0;
}
export function roleShort(role) {
  return role.members ? role.members.length : 0;
}
export function roleUnmet(role) {
  return role.min > 0 && roleShort(role) < role.min;
}
// a slot with a max is full once it reaches that many people
export function roleFull(role) {
  return role.max != null && roleShort(role) >= role.max;
}
// whether any required slot on the event is still unfilled
export function hasUnmetRole(e) {
  return hasRoles(e) && e.roles.some(roleUnmet);
}
// build a Date from the event's date + a "HH:MM" time
export function eventDateTime(e, time) {
  if (!e.date || !time) return null;
  const [y, m, d] = e.date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
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
   members of the hosting org.) */
export const CANCEL_WINDOW_MS = 60 * 60 * 1000; // one hour before start
export function shiftEnded(e) {
  const end = eventDateTime(e, e.end);
  return end != null && Date.now() > end.getTime();
}
// in the final hour-before-start-through-end window
export function inCancelWindow(e) {
  const start = eventDateTime(e, e.start);
  const end = eventDateTime(e, e.end);
  if (!start || !end) return false;
  const now = Date.now();
  return now >= start.getTime() - CANCEL_WINDOW_MS && now <= end.getTime();
}
// hard cancelled: a required slot is unfilled inside the cancel window
export function shiftCancelled(e) {
  return hasUnmetRole(e) && inCancelWindow(e);
}
// neutral pre-window warning: a required slot is unfilled but there's still time
export function shiftNeedsSlots(e) {
  return hasUnmetRole(e) && !inCancelWindow(e) && !shiftEnded(e);
}
