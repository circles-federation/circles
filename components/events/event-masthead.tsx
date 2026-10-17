import clsx from "clsx";
import { DateTile } from "./date-tile";
import { VideoCameraIcon } from "@heroicons/react/24/outline";
import { ButtonLink, Eyebrow, MastheadChip } from "@/components/shared";
import { meetingLink } from "@/lib/events.util";
import { MONTHS, WEEKDAYS, fmtTime, isPastEvent, parseDay } from "@/lib/format.util";
import { awaitingConsent } from "@/lib/governance.util";
import { endedBefore, repeatSummary } from "@/lib/recurrence.util";
import { useCirclesById } from "@/lib/hooks";
import type { Event } from "@/lib/types";

interface EventMastheadProps {
  event: Event;
}

/* Date tile, kind/exclusivity badges, title, and location — the header
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
  const topBorderClass = past ? "border-t-soft" : gov ? "border-t-flame" : "border-t-ink";

  const link = meetingLink(e.location);
  const govLabel = gov && <span className="text-flame">Proposed</span>;
  const time = `${fmtTime(e.start)}–${fmtTime(e.end)}`;
  // how it repeats, unless its series ended before this date (it was
  // cancelled along with the rest)
  const repeats = e.repeat && !endedBefore(e.repeat, e.date) ? repeatSummary(e.repeat) : null;
  // the date in words, for a phone, which has no room for the tile
  const day = parseDay(e.date);
  const dateLabel = e.date && !isNaN(day.getTime()) ? `${WEEKDAYS[day.getDay()]}, ${MONTHS[day.getMonth()]} ${day.getDate()}` : "Date TBD";

  return (
    /* Laid out like a circle page's masthead: an eyebrow opposite the circle
       (who can see this event — a place chip, so it reads the same as
       everywhere else a circle's name appears), then the title and location.
       Wide, the date tile sits to the left of all that and the eyebrow is the
       time; on a phone there's no room for the tile, so the eyebrow is the
       date, with the time on a line of its own beneath it. */
    <div
      className={clsx(
        "grid grid-cols-1 border-t-[3px] border-b border-b-ink pt-5 pb-6 min-[720px]:grid-cols-[auto_minmax(0,1fr)] min-[720px]:gap-x-6",
        topBorderClass
      )}
    >
      <div className="hidden min-[720px]:col-start-1 min-[720px]:row-span-3 min-[720px]:row-start-1 min-[720px]:block">
        <DateTile iso={e.date} large accent={gov ? govAccent : undefined} />
      </div>
      {/* the eyebrow lines as one block, with the chip opposite its top */}
      <div className="row-start-1 flex min-w-0 items-start justify-between gap-3 min-[720px]:col-start-2">
        <div className="min-w-0">
          {/* a phone: the date, then the time and how it repeats, a line each */}
          <div className="min-[720px]:hidden">
            <Eyebrow className="block text-soft">
              {govLabel && <>{govLabel} · </>}
              {dateLabel}
            </Eyebrow>
            <Eyebrow className="mt-1.5 block text-soft">{time}</Eyebrow>
            {repeats && <Eyebrow className="mt-1.5 block text-soft">{repeats}</Eyebrow>}
          </div>
          {/* wide: the time and how it repeats, beside the tile's date */}
          <Eyebrow className="hidden text-soft min-[720px]:block">
            {govLabel && <>{govLabel} · </>}
            {time}
            {repeats && ` · ${repeats}`}
          </Eyebrow>
        </div>
        {/* capped, so a long circle name ends in "…" instead of squeezing the time */}
        {circle ? <MastheadChip max="max-w-[45%]" title={`${circle.name}: who can see this event`}>{circle.name}</MastheadChip> : <span />}
      </div>
      <h1 className="row-start-2 mt-3 font-sans text-heading leading-[0.95] font-extrabold tracking-[-0.035em] min-[720px]:col-start-2 min-[720px]:text-title">
        {e.title}
      </h1>
      {/* an online event's location is its link: a button to it, not the address */}
      {link ? (
        <div className="row-start-3 mt-4 min-[720px]:col-start-2">
          <ButtonLink href={link} target="_blank" rel="noopener noreferrer">
            <VideoCameraIcon className="size-4" strokeWidth={2.5} aria-hidden />
            Join meeting
          </ButtonLink>
        </div>
      ) : (
        <p className="row-start-3 mt-3 font-serif text-lg text-body min-[720px]:col-start-2">{e.location}</p>
      )}
    </div>
  );
}
