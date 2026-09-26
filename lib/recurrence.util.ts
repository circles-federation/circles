import { MONTHS, parseDay } from "./format.util";
import type { EventRepeat, RepeatFrequency } from "./types";

/* When a repeating event's dates fall. A series is read from its first date:
   weekly repeats that weekday, and monthly repeats that weekday's place in
   the month ("the 2nd Tuesday") — how community groups actually meet — rather
   than the day number, which would need a rule for the 31st anyway. A first
   date on the 29th–31st means "the last" such weekday. Days are "YYYY-MM-DD"
   strings throughout, worked out in UTC so a daylight-saving change can't
   shift one. */

export const REPEAT_FREQUENCIES: RepeatFrequency[] = ["weekly", "monthly"];

// how far ahead a series' dates exist as events (see extendEventSeries in
// lib/db/events.ts): enough to plan around, few enough that a weekly event
// doesn't fill the events list
export const REPEAT_HORIZON_DAYS: Record<RepeatFrequency, number> = { weekly: 28, monthly: 62 };
export const REPEAT_HORIZON_LABEL: Record<RepeatFrequency, string> = { weekly: "four weeks", monthly: "about two months" };

// what a list row says about a date of a repeating event, where space is short
export const REPEAT_SHORT_LABEL: Record<RepeatFrequency, string> = { weekly: "Weekly", monthly: "Monthly" };

const DAY_MS = 86_400_000;
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDINALS = ["1st", "2nd", "3rd", "4th"];
// a series never needs more dates than this; stops a runaway loop on bad input
const MAX_OCCURRENCES = 2000;

function toUtc(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

const fromUtc = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(iso: string, n: number): string {
  return fromUtc(new Date(toUtc(iso).getTime() + n * DAY_MS));
}

// today in this machine's own timezone, as isPastEvent reckons it
export function localDay(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// which of its month's weekdays a day is: the 1st-4th, or the last
function weekOfMonth(iso: string): number | "last" {
  const day = toUtc(iso).getUTCDate();
  return day > 28 ? "last" : Math.ceil(day / 7);
}

// the series' kth date, the first being k = 0
function nthDate(frequency: RepeatFrequency, startsOn: string, k: number): string {
  if (frequency === "weekly") return addDays(startsOn, 7 * k);
  const start = toUtc(startsOn);
  const weekday = start.getUTCDay();
  const week = weekOfMonth(startsOn);
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + k;
  if (week === "last") {
    const last = new Date(Date.UTC(year, month + 1, 0));
    return fromUtc(new Date(last.getTime() - ((last.getUTCDay() - weekday + 7) % 7) * DAY_MS));
  }
  const first = new Date(Date.UTC(year, month, 1));
  return fromUtc(new Date(Date.UTC(year, month, 1 + ((weekday - first.getUTCDay() + 7) % 7) + (week - 1) * 7)));
}

// the series' dates after `after` and up to `through` (and its own last date,
// `until`, if it has one), soonest first
export function datesBetween(frequency: RepeatFrequency, startsOn: string, after: string, through: string, until?: string | null): string[] {
  const end = until && until < through ? until : through;
  const dates: string[] = [];
  for (let k = 0; k < MAX_OCCURRENCES; k++) {
    const date = nthDate(frequency, startsOn, k);
    if (date > end) break;
    if (date > after) dates.push(date);
  }
  return dates;
}

// "Every Tuesday", "Monthly on the 2nd Tuesday", "Monthly on the last Friday"
export function repeatLabel(frequency: RepeatFrequency, startsOn: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) return frequency === "weekly" ? "Every week" : "Every month";
  const weekday = WEEKDAY_NAMES[toUtc(startsOn).getUTCDay()];
  if (frequency === "weekly") return `Every ${weekday}`;
  const week = weekOfMonth(startsOn);
  return `Monthly on the ${week === "last" ? "last" : ORDINALS[week - 1]} ${weekday}`;
}

// the whole pattern, with its last date if it has one: "Every Tuesday until Dec 1"
export function repeatSummary(r: Pick<EventRepeat, "frequency" | "startsOn" | "until">): string {
  const label = repeatLabel(r.frequency, r.startsOn);
  if (!r.until) return label;
  const until = parseDay(r.until);
  return `${label} until ${MONTHS[until.getMonth()]} ${until.getDate()}`;
}

// a series whose last date was set before this one: it was cancelled along
// with every later date (see cancelEvent in lib/db/events.ts)
export function endedBefore(r: Pick<EventRepeat, "until"> | undefined, date: string): boolean {
  return !!r?.until && r.until < date;
}
