"use client";

import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { Eyebrow, Section } from "@/components/shared";
import { eventStartsAt, isAttending, meetingLink } from "@/lib/events.util";
import { fmtTime } from "@/lib/format.util";
import { eventDateTime } from "@/lib/roles.util";
import { useClock } from "@/lib/hooks";
import type { Event } from "@/lib/types";

// how long before an event's start the card appears
const BEFORE_MS = 15 * 60_000;

// the sticker's countdown, in whole minutes rounded up, so it never says
// "In 0 min" while there's still time
function countdown(msToStart: number): string {
  if (msToStart <= 0) return "Now";
  return `In ${Math.ceil(msToStart / 60_000)} min`;
}

/* Home's hero for an event you're going to: it appears 15 minutes before the
   start, counting down on a big tilted sticker (the same playful type as a
   profile's "Born in the" decade), says "Now" once it's begun, and stays
   until it ends. One at a time, never a cancelled one: the next to start if
   one's coming up, since that's the one to set off for, and otherwise the
   one under way that began last. */
export function StartingSoon({ events, memberId, rsvpState }: { events: Event[]; memberId: number; rsvpState: Record<string, boolean> }) {
  const now = useClock();
  if (now === null) return null;

  const shown = events
    .filter((e) => !e.cancelled && (isAttending(e, memberId) || rsvpState[e.id]))
    .map((e) => {
      const start = eventStartsAt(e).getTime();
      // an end at or before the start (malformed) ends it at the start
      const end = Math.max(eventDateTime(e, e.end)?.getTime() ?? start, start);
      return { e, ms: start - now, over: now >= end };
    })
    .filter(({ ms, over }) => ms <= BEFORE_MS && !over)
    // upcoming (positive) before under way (negative), each nearest first
    .sort((a, b) => (a.ms > 0) !== (b.ms > 0) ? (a.ms > 0 ? -1 : 1) : Math.abs(a.ms) - Math.abs(b.ms))[0];
  if (!shown) return null;
  const { e, ms } = shown;

  return (
    // pt-12: room above the card for the sticker hanging off its top edge
    <Section className="pt-12">
      {/* the whole card inverts while pressed, sticker and all */}
      <Link href={`/events/${e.id}`} aria-label={`${e.title}, ${ms > 0 ? `starting ${countdown(ms).toLowerCase()}` : "happening now"}`} className="press-invert block text-paper no-underline">
        <div className="relative bg-ink px-5 pt-14 pb-5 min-[720px]:px-7">
          <span
            aria-hidden
            className="absolute -top-6 left-3 -rotate-4 border-[3px] border-ink bg-paper px-4 pt-2 pb-1.5 font-sans text-title leading-none font-extrabold tracking-[-0.04em] text-ink"
          >
            {countdown(ms)}
          </span>
          <div className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-flame motion-safe:animate-pulse" />
            <Eyebrow className="text-paper/70">{ms > 0 ? "Starting soon" : "Happening now"}</Eyebrow>
          </div>
          <div className="mt-3 font-sans text-title leading-[0.95] font-extrabold tracking-[-0.035em]">{e.title}</div>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div className="min-w-0 font-serif text-lg leading-snug text-paper/85">
              {fmtTime(e.start)} · {meetingLink(e.location) ? "Online" : e.location}
            </div>
            <ArrowRightIcon className="size-6 shrink-0" strokeWidth={2.5} />
          </div>
        </div>
      </Link>
    </Section>
  );
}
