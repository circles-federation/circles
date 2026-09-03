import { PencilIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { DateTile } from "./date-tile";
import { Button, Eyebrow } from "@/components/shared";
import { MONTHS, WEEKDAYS, fmtTime, isPastEvent, parseDay } from "@/lib/format.util";
import { isConfirmed, isEventOrganizer, isExclusive, kindOf } from "@/lib/governance.util";
import type { Event, Profile } from "@/lib/types";

interface EventMastheadProps {
  event: Event;
  events: Event[];
  profile: Profile;
  onOpenEvent: (e: Event) => void;
  onEdit: () => void;
}

/* Date tile, kind/exclusivity badges, title, and location — the header
   block every event detail page opens with. The organizer (the event's own
   host, or any member of its hosting org) gets an edit button, laid out the
   same responsive way as Home's own masthead: a full-width row of its own
   beneath the rest (with a text label, since it's got the room) below
   720px, then a small icon-only square beside the date tile / title column
   above it. */
export function EventMasthead({ event: e, events, profile, onOpenEvent, onEdit }: EventMastheadProps) {
  const k = kindOf(e);
  const isOrganizer = isEventOrganizer(e, profile);
  const gov = k.governance;
  const confirmed = isConfirmed(e);
  const govAccent = confirmed ? "leaf" : "flame";
  const exclusive = isExclusive(e);
  const past = isPastEvent(e);
  const d = parseDay(e.date);
  const isCouncil = e.kind === "council";
  const topBorderClass = gov
    ? (past && !confirmed ? "border-t-soft" : (confirmed ? "border-t-leaf" : "border-t-flame"))
    : (past ? "border-t-soft" : (exclusive ? "border-t-plum" : "border-t-ink"));

  return (
    <div className={clsx("mt-4 flex flex-col items-stretch gap-4.5 border-t-[3px] border-b border-b-ink pt-4.5 pb-5.5 min-[720px]:flex-row min-[720px]:items-start min-[720px]:gap-5.5", topBorderClass)}>
      <div className="flex flex-1 items-start gap-5.5">
        <DateTile iso={e.date} large accent={gov ? govAccent : (exclusive ? "plum" : undefined)} />
        <div className="flex-1">
          {gov && (
            <div className="mb-2.5 flex items-center gap-2">
              <Eyebrow className={confirmed ? "text-leaf" : "text-flame"}>{k.label}</Eyebrow>
              <span className={clsx("border px-1.75 py-0.5 font-sans text-label font-bold uppercase tracking-[0.08em]", confirmed ? "border-leaf text-leaf" : "border-flame text-flame")}>
                {confirmed ? "Confirmed" : "Proposed"}
              </span>
            </div>
          )}
          {exclusive && (
            <div className="mb-2.5 flex items-center gap-2">
              <span className="border border-plum px-1.75 py-0.5 font-sans text-label font-bold uppercase tracking-[0.08em] text-plum">
                ◆ Members only
              </span>
            </div>
          )}
          <Eyebrow className="text-soft">
            {e.date && !isNaN(d.getTime())
              ? <>{WEEKDAYS[d.getDay()]}, {MONTHS[d.getMonth()]} {d.getDate()} · {fmtTime(e.start)}–{fmtTime(e.end)}</>
              : <>Date to be set · {fmtTime(e.start)}–{fmtTime(e.end)}</>}
          </Eyebrow>
          <h1 className="mt-3 font-sans text-heading min-[720px]:text-title font-extrabold tracking-[-0.035em] leading-[0.95]">{e.title}</h1>
          {isCouncil && e.sponsor && (() => {
            // hoisted above the closure below — TS narrowing on `e.sponsor`
            // doesn't survive into a nested closure evaluated later (onClick),
            // only into code evaluated immediately in this same scope.
            const sponsor = e.sponsor;
            return (
              <button
                onClick={() => { const a = (events || []).find((x) => x.id === sponsor.id); if (a) onOpenEvent(a); }}
                className="mt-3 block cursor-pointer border-none bg-transparent p-0 text-left"
              >
                {/* text-micro omitted on purpose: Eyebrow's own inline-style guard already
                    dropped this sub-11px override in the original code (see eyebrow.jsx) —
                    keeping the effective size (its default) rather than actually applying
                    micro, since a className override wouldn't get silently ignored the
                    same way. */}
                <Eyebrow className="text-flame">Convened by {sponsor.name} →</Eyebrow>
              </button>
            );
          })()}
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
