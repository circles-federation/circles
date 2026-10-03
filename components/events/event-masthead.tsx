import clsx from "clsx";
import { DateTile } from "./date-tile";
import { Chip, Eyebrow } from "@/components/shared";
import { fmtTime, isPastEvent } from "@/lib/format.util";
import { isApproved, isVoting } from "@/lib/governance.util";
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
  // a meeting, or a circle-hosted event still awaiting its vote — an approved
  // one is settled and reads like any other event
  const gov = isVoting(e);
  const approved = isApproved(e, byId);
  const govAccent = approved ? "leaf" : "flame";
  const past = isPastEvent(e);
  const topBorderClass = gov
    ? (past && !approved ? "border-t-soft" : (approved ? "border-t-leaf" : "border-t-flame"))
    : (past ? "border-t-soft" : "border-t-ink");

  return (
    <div className={clsx("border-t-[3px] border-b border-b-ink pt-4.5 pb-5.5", topBorderClass)}>
      {/* the date tile and what's beside it start just under the top rule, and
          the circle — who can see this event, shown as a place chip so it reads
          the same as everywhere else a circle's name appears — sits opposite
          them, as a circle page puts its parent opposite its type */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-5.5">
          <DateTile iso={e.date} large accent={gov ? govAccent : undefined} />
          <div className="min-w-0 flex-1">
            {gov && <Eyebrow className={clsx("mb-1.5", approved ? "text-leaf" : "text-flame")}>{approved ? "Approved" : "Proposed"}</Eyebrow>}
            {/* just the time: the date tile beside it already gives the date
                and weekday (or TBD) — and how it repeats, unless its series
                ended before this date (it was cancelled along with the rest) */}
            <Eyebrow className="text-soft">
              {fmtTime(e.start)}–{fmtTime(e.end)}
              {e.repeat && !endedBefore(e.repeat, e.date) && <> · {repeatSummary(e.repeat)}</>}
            </Eyebrow>
            <h1 className="mt-3 font-sans text-heading min-[720px]:text-title font-extrabold tracking-[-0.035em] leading-[0.95]">{e.title}</h1>
            <p className="mt-3 font-serif text-lg text-[#222]">{e.location}</p>
          </div>
        </div>
        {circle && (
          <span className="flex max-w-[40%] min-w-0 shrink-0 justify-end">
            <Chip title="Who can see this event">{circle.name}</Chip>
          </span>
        )}
      </div>
    </div>
  );
}
