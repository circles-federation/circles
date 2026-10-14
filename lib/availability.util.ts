import { parseDay } from "./format.util";
import type { AvailabilityWindow } from "./types";

/* When a member can do meetings, as pure rules shared by Settings → Meeting
   availability (instant feedback), the meeting form's who's-free list and
   lib/db (the real check). A schedule is a list of weekly windows: some days
   and a time range, like one of iOS's sleep schedules. Times are the
   community's wall-clock time, minutes from midnight, with no zone of their
   own (the same as an event's), and a window never crosses midnight.

   `null` is a schedule that was never set, which is not the same as `[]`
   (someone who's said they never can): the first is Unknown on the meeting
   form, the second Not available. */

export const AVAILABILITY_STEP = 15;
export const MAX_AVAILABILITY_WINDOWS = 14;
export const DAY_END = 24 * 60;

export type AvailabilityStatus = "available" | "unavailable" | "unknown";

export interface AvailabilityPreset {
  key: string;
  label: string;
  window: AvailabilityWindow;
}

const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];

// the chips on the editor: each adds one window, which can then be edited
export const AVAILABILITY_PRESETS: readonly AvailabilityPreset[] = [
  { key: "weekday-evenings", label: "Weekday evenings", window: { days: WEEKDAYS, start: 18 * 60, end: 21 * 60 } },
  { key: "weekday-lunch", label: "Weekday lunch", window: { days: WEEKDAYS, start: 12 * 60, end: 13 * 60 } },
  { key: "weekend-mornings", label: "Weekend mornings", window: { days: WEEKEND, start: 9 * 60, end: 12 * 60 } },
  { key: "weekend-afternoons", label: "Weekend afternoons", window: { days: WEEKEND, start: 13 * 60, end: 17 * 60 } },
];

// "18:30" → 1110
export function clockMinutes(clock: string): number {
  const [h, m] = clock.split(":").map(Number) as [number, number];
  return h * 60 + m;
}

// 1110 → "18:30", for a time field; the end of the day, 1440, reads "00:00"
// since a field has no 24:00
export function minutesClock(minutes: number): string {
  const m = minutes % DAY_END;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// what a time field says, as minutes snapped to the quarter hour. A window's
// end at "00:00" is the end of the day, not its start.
export function fieldMinutes(value: string, isEnd: boolean): number {
  const minutes = Math.round(clockMinutes(value) / AVAILABILITY_STEP) * AVAILABILITY_STEP;
  return isEnd && minutes % DAY_END === 0 ? DAY_END : minutes % DAY_END;
}

// the first problem with a schedule, or null when it's fine. Overlapping
// windows aren't a problem: normalizeAvailability merges them.
export function validateAvailability(windows: AvailabilityWindow[]): string | null {
  if (windows.length > MAX_AVAILABILITY_WINDOWS) return `Keep it to ${MAX_AVAILABILITY_WINDOWS} windows or fewer.`;
  for (const w of windows) {
    if (w.days.length === 0) return "Pick at least one day for each window.";
    if (new Set(w.days).size !== w.days.length || w.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return "Pick days of the week.";
    if (![w.start, w.end].every((t) => Number.isInteger(t) && t % AVAILABILITY_STEP === 0)) return "Pick times on the quarter hour.";
    if (w.start < 0 || w.end > DAY_END) return "Pick times within a day.";
    if (w.end <= w.start) return "Each window needs to end after it starts.";
  }
  return null;
}

// a day's windows as separate, sorted ranges, touching or overlapping ones joined
export function dayRanges(windows: AvailabilityWindow[], day: number): { start: number; end: number }[] {
  const sorted = windows.filter((w) => w.days.includes(day)).map((w) => ({ start: w.start, end: w.end })).sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push(r);
  }
  return merged;
}

/* The one way a schedule is written down, so equal schedules are equal data:
   each day's ranges joined, then days with the same range grouped into one
   window, in time order. */
export function normalizeAvailability(windows: AvailabilityWindow[]): AvailabilityWindow[] {
  const byRange = new Map<string, AvailabilityWindow>();
  for (let day = 0; day < 7; day++) {
    for (const r of dayRanges(windows, day)) {
      const key = `${r.start}-${r.end}`;
      const found = byRange.get(key);
      if (found) found.days.push(day);
      else byRange.set(key, { days: [day], start: r.start, end: r.end });
    }
  }
  return [...byRange.values()].sort((a, b) => a.start - b.start || a.end - b.end || a.days[0]! - b.days[0]!);
}

export function sameAvailability(a: AvailabilityWindow[], b: AvailabilityWindow[]): boolean {
  return JSON.stringify(normalizeAvailability(a)) === JSON.stringify(normalizeAvailability(b));
}

// whether a window is exactly a preset's
export function matchesPreset(w: AvailabilityWindow, preset: AvailabilityPreset): boolean {
  return w.start === preset.window.start && w.end === preset.window.end && w.days.length === preset.window.days.length && preset.window.days.every((d) => w.days.includes(d));
}

// whether a preset's window is already in the schedule (so its chip shows as picked)
export function hasPreset(windows: AvailabilityWindow[], preset: AvailabilityPreset): boolean {
  return windows.some((w) => matchesPreset(w, preset));
}

/* Whether someone with this schedule can attend something on `date` from
   `start` to `end` ("HH:MM"). They can only if one range covers all of it;
   `freeUntil` (minutes from midnight) says when they stop being free, for
   someone who's free as it begins but not through to its end. */
export function availabilityFor(windows: AvailabilityWindow[] | null, date: string, start: string, end: string): { status: AvailabilityStatus; freeUntil?: number } {
  if (!windows) return { status: "unknown" };
  const from = clockMinutes(start);
  const to = clockMinutes(end);
  if (to <= from) return { status: "unavailable" };
  const ranges = dayRanges(windows, parseDay(date).getDay());
  if (ranges.some((r) => r.start <= from && to <= r.end)) return { status: "available" };
  const partly = ranges.find((r) => r.start <= from && from < r.end);
  return partly ? { status: "unavailable", freeUntil: partly.end } : { status: "unavailable" };
}
