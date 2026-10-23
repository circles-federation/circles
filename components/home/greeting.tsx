"use client";

import { Eyebrow } from "@/components/shared";
import { MONTHS } from "@/lib/format.util";
import { useClock } from "@/lib/hooks";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function partOfDay(hour: number): string {
  if (hour >= 4 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

/* Home's opening line, as Apple's summary screens open: today's date over a
   greeting by name, for the time of day. Read from the clock, which the
   server doesn't have, so until it's read the date line holds its height
   and the greeting is a plain hello; nothing moves when they fill in. */
export function Greeting({ name }: { name: string }) {
  const now = useClock();
  const today = now === null ? null : new Date(now);
  return (
    <header>
      <Eyebrow className="block text-soft">{today ? `${DAYS[today.getDay()]}, ${MONTHS[today.getMonth()]} ${today.getDate()}` : " "}</Eyebrow>
      <h1 className="m-0 mt-1.5 font-sans text-title leading-[1.05] font-extrabold tracking-display wrap-break-word">
        {today ? partOfDay(today.getHours()) : "Hello"}, {name}
      </h1>
    </header>
  );
}
