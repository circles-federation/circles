import { VideoCameraIcon } from "@heroicons/react/24/outline";
import { DateTile } from "./date-tile";
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

function whenOf(e: Event) {
  const past = isPastEvent(e);
  const link = meetingLink(e.location);
  const time = `${fmtTime(e.start)}–${fmtTime(e.end)}`;
  // how it repeats, unless its series ended before this date (it was
  // cancelled along with the rest)
  const repeats = e.repeat && !endedBefore(e.repeat, e.date) ? repeatSummary(e.repeat) : null;
  const day = parseDay(e.date);
  const dateLabel = e.date && !isNaN(day.getTime()) ? `${WEEKDAYS[day.getDay()]}, ${MONTHS[day.getMonth()]} ${day.getDate()}` : "Date TBD";
  return { past, link, time, repeats, dateLabel };
}

/* When and Where as a boxed pair of facts, each its own label: the event page
   puts it first in its right-hand column from 960px, and under the header and
   any notices on a phone. */
export function EventFacts({ event: e }: { event: Event }) {
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
  );
}

/* Kind, circle chip and title — the header block every event detail page
   opens with. From 960px the title is larger and the date a big tile at the
   right. Its When and Where (EventFacts) follow it on the page. Editing it is the top bar's pencil, for its organizer (see TopBar's
   pageAction). The wash behind it is the page's (MastheadGlow). */
export function EventMasthead({ event: e }: EventMastheadProps) {
  const byId = useCirclesById();
  const circle = byId[e.circleId];
  // a meeting or circle-hosted event still awaiting its circle's consent — a
  // decided one is settled and reads like any other event
  const gov = awaitingConsent(e);
  const { past } = whenOf(e);
  const govLabel = gov && <span className="text-flame-text">Proposed</span>;

  return (
    <div className="relative isolate pb-6 min-[960px]:grid min-[960px]:grid-cols-[1fr_auto] min-[960px]:items-end min-[960px]:gap-x-12 min-[960px]:pt-4">
      <MastheadGlow />
      <div className="min-w-0">
        <div className="flex min-w-0 items-start justify-between gap-3 min-[960px]:items-center min-[960px]:justify-start min-[960px]:gap-4">
          <Eyebrow className="shrink-0 pt-1.5 min-[960px]:pt-0">{govLabel || (past ? "Past event" : "Event")}</Eyebrow>
          {/* capped, so a long circle name ends in "…" */}
          {circle ? <CappedChip max="max-w-[60%]" title={`${circle.name}: who can see this event`}>{circle.name}</CappedChip> : <span />}
        </div>
        <h1 className="mt-4 font-sans text-title leading-[0.95] font-extrabold tracking-display wrap-anywhere min-[960px]:text-[64px] min-[960px]:leading-[1.02]">{e.title}</h1>
      </div>
      <div className="hidden min-[960px]:block">
        <DateTile iso={e.date} large accent={gov ? "flame" : undefined} />
      </div>
    </div>
  );
}
