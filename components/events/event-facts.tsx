import { VideoCameraIcon } from "@heroicons/react/24/outline";
import { ButtonLink, Eyebrow } from "@/components/shared";
import { meetingLink } from "@/lib/events.util";
import { MONTHS, WEEKDAYS, fmtTime, parseDay } from "@/lib/format.util";
import { endedBefore, repeatSummary } from "@/lib/recurrence.util";
import type { Event } from "@/lib/types";

// what When and Where need, so a shared event (no signed-in viewer, no series) can use them too
export type FactsEvent = Pick<Event, "date" | "start" | "end" | "location" | "repeat">;

function whenOf(e: FactsEvent) {
  const link = meetingLink(e.location);
  const time = `${fmtTime(e.start)}–${fmtTime(e.end)}`;
  // how it repeats, unless its series ended before this date (it was
  // cancelled along with the rest)
  const repeats = e.repeat && !endedBefore(e.repeat, e.date) ? repeatSummary(e.repeat) : null;
  const day = parseDay(e.date);
  const dateLabel = e.date && !isNaN(day.getTime()) ? `${WEEKDAYS[day.getDay()]}, ${MONTHS[day.getMonth()]} ${day.getDate()}` : "Date TBD";
  return { link, time, repeats, dateLabel };
}

/* When and Where as a boxed pair of facts, each its own label: the event page
   puts it first in its right-hand column from 960px, and under the header and
   any notices on a phone. In its own file, with no hooks, so the public page
   can stay a Server Component. `closed` (cancelled or over) says "Online" in
   place of a join button, since there's nothing left to join. */
export function EventFacts({ event: e, closed = false }: { event: FactsEvent; closed?: boolean }) {
  const { link, time, repeats, dateLabel } = whenOf(e);
  return (
    <div className="grid grid-cols-1 border border-ink bg-paper min-[480px]:grid-cols-2">
      <div className="px-4 py-4 min-[480px]:border-r min-[480px]:border-ink">
        <Eyebrow className="text-soft">When</Eyebrow>
        <div className="mt-2 font-sans text-lg leading-snug font-extrabold tracking-snug">{dateLabel}</div>
        <div className="mt-0.5 font-serif text-sm text-soft">
          {time}
          {repeats && ` · ${repeats}`}
        </div>
      </div>
      <div className="border-t border-ink px-4 py-4 min-[480px]:border-t-0">
        <Eyebrow className="text-soft">Where</Eyebrow>
        {/* an online event's location is its link: a button to it, not the address */}
        {link && !closed ? (
          <div className="mt-2">
            <ButtonLink href={link} target="_blank" rel="noopener noreferrer" size="compact">
              <VideoCameraIcon className="size-4" strokeWidth={2.5} aria-hidden />
              Join meeting
            </ButtonLink>
          </div>
        ) : (
          <div className="mt-2 font-sans text-lg leading-snug font-extrabold tracking-snug">{link ? "Online" : e.location}</div>
        )}
      </div>
    </div>
  );
}
