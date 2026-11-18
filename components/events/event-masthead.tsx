import { VideoCameraIcon } from "@heroicons/react/24/outline";
import { ButtonLink, Eyebrow, CappedChip, MastheadGlow } from "@/components/shared";
import { meetingLink } from "@/lib/events.util";
import { MONTHS, WEEKDAYS, fmtTime, isPastEvent, parseDay } from "@/lib/format.util";
import { awaitingConsent } from "@/lib/governance.util";
import { endedBefore, repeatSummary } from "@/lib/recurrence.util";
import { useCirclesById } from "@/lib/hooks";
import type { Event } from "@/lib/types";

interface EventMastheadProps {
  event: Event;
}

/* Kind, circle chip, title and its When and Where — the header
   block every event detail page opens with. Editing it is the top bar's
   pencil, for its organizer (see TopBar's pageAction). */
export function EventMasthead({ event: e }: EventMastheadProps) {
  const byId = useCirclesById();
  const circle = byId[e.circleId];
  // a meeting or circle-hosted event still awaiting its circle's consent — a
  // decided one is settled and reads like any other event
  const gov = awaitingConsent(e);
  const govAccent = "flame";
  const past = isPastEvent(e);

  const link = meetingLink(e.location);
  const govLabel = gov && <span className="text-flame-text">Proposed</span>;
  const time = `${fmtTime(e.start)}–${fmtTime(e.end)}`;
  // how it repeats, unless its series ended before this date (it was
  // cancelled along with the rest)
  const repeats = e.repeat && !endedBefore(e.repeat, e.date) ? repeatSummary(e.repeat) : null;
  // the date in words, for a phone, which has no room for the tile
  const day = parseDay(e.date);
  const dateLabel = e.date && !isNaN(day.getTime()) ? `${WEEKDAYS[day.getDay()]}, ${MONTHS[day.getMonth()]} ${day.getDate()}` : "Date TBD";

  return (
    /* Laid out like a circle page's masthead: the kind opposite the circle
       (who can see this event: a place chip, so it reads the same as everywhere
       else a circle's name appears), the title, then When and Where as a boxed
       pair of facts, each its own label. The wash behind it is the page's
       (MastheadGlow). */
    <div className="relative isolate pb-6">
      <MastheadGlow />
      <div className="flex min-w-0 items-start justify-between gap-3">
        <Eyebrow className="shrink-0 pt-1.5">{govLabel || (past ? "Past event" : "Event")}</Eyebrow>
        {/* capped, so a long circle name ends in "…" */}
        {circle ? <CappedChip max="max-w-[60%]" title={`${circle.name}: who can see this event`}>{circle.name}</CappedChip> : <span />}
      </div>
      <h1 className="mt-4 font-sans text-title leading-[0.95] font-extrabold tracking-display wrap-anywhere">{e.title}</h1>
      <div className="mt-6 grid grid-cols-1 border border-ink bg-paper min-[480px]:grid-cols-2">
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
          {link ? (
            <div className="mt-2">
              <ButtonLink href={link} target="_blank" rel="noopener noreferrer" size="compact">
                <VideoCameraIcon className="size-4" strokeWidth={2.5} aria-hidden />
                Join meeting
              </ButtonLink>
            </div>
          ) : (
            <div className="mt-2 font-sans text-lg leading-snug font-extrabold tracking-snug">{e.location}</div>
          )}
        </div>
      </div>
    </div>
  );
}
