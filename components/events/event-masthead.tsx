import { PencilIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { DateTile } from "./date-tile";
import { Button, Chip, Eyebrow } from "@/components/shared";
import { MONTHS, WEEKDAYS, fmtTime, isPastEvent, parseDay } from "@/lib/format.util";
import { isConfirmed, isEventOrganizer, isVoting } from "@/lib/governance.util";
import { useCirclesById } from "@/lib/hooks";
import type { Event, Profile } from "@/lib/types";

interface EventMastheadProps {
  event: Event;
  profile: Profile;
  onEdit: () => void;
}

/* Date tile, kind/exclusivity badges, title, and location — the header
   block every event detail page opens with. The organizer (the person
   hosting the event) gets an edit button, laid out the
   same responsive way as Home's own masthead: a full-width row of its own
   beneath the rest (with a text label, since it's got the room) below
   720px, then a small icon-only square beside the date tile / title column
   above it. */
export function EventMasthead({ event: e, profile, onEdit }: EventMastheadProps) {
  const byId = useCirclesById();
  const isOrganizer = isEventOrganizer(e, profile);
  const circle = byId[e.circleId];
  // a meeting, or a circle-hosted event still awaiting its vote — an approved
  // one is settled and reads like any other event
  const gov = isVoting(e);
  const confirmed = isConfirmed(e, byId);
  const govAccent = confirmed ? "leaf" : "flame";
  const past = isPastEvent(e);
  const d = parseDay(e.date);
  const topBorderClass = gov
    ? (past && !confirmed ? "border-t-soft" : (confirmed ? "border-t-leaf" : "border-t-flame"))
    : (past ? "border-t-soft" : "border-t-ink");

  return (
    <div className={clsx("mt-4 flex flex-col items-stretch gap-4.5 border-t-[3px] border-b border-b-ink pt-4.5 pb-5.5 min-[720px]:flex-row min-[720px]:items-start min-[720px]:gap-5.5", topBorderClass)}>
      <div className="flex flex-1 items-start gap-5.5">
        <DateTile iso={e.date} large accent={gov ? govAccent : undefined} />
        <div className="flex-1">
          {/* the circle is who can see this event — shown as a place chip, so
              it reads the same as everywhere else a circle's name appears */}
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            {gov && <Eyebrow className={confirmed ? "text-leaf" : "text-flame"}>{confirmed ? "Confirmed" : "Proposed"}</Eyebrow>}
            {circle && <Chip title="Who can see this event">{circle.name}</Chip>}
          </div>
          <Eyebrow className="text-soft">
            {e.date && !isNaN(d.getTime())
              ? <>{WEEKDAYS[d.getDay()]}, {MONTHS[d.getMonth()]} {d.getDate()} · {fmtTime(e.start)}–{fmtTime(e.end)}</>
              : <>Date to be set · {fmtTime(e.start)}–{fmtTime(e.end)}</>}
          </Eyebrow>
          <h1 className="mt-3 font-sans text-heading min-[720px]:text-title font-extrabold tracking-[-0.035em] leading-[0.95]">{e.title}</h1>
          <p className="mt-3 font-serif text-lg text-[#222]">{e.location}</p>
        </div>
      </div>
      {isOrganizer && (
        <Button variant="secondary" onClick={onEdit}>
          <PencilIcon className="size-3.5" strokeWidth={2.5} />
          Edit Event
        </Button>
      )}
    </div>
  );
}
