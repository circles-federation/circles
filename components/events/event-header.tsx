import type { ReactNode } from "react";
import { DateTile, type DateTileAccent } from "./date-tile";
import { CappedChip, Eyebrow, type ChipTone } from "@/components/shared";

interface EventHeaderProps {
  // what it is: Event, Past event, Proposed, Cancelled
  label: ReactNode;
  // the circle it's shown to, as a place chip; none, and there's no chip
  circleName?: string | null;
  chipTitle?: string;
  // a chip's colour where there's no signed-in member to work it out from
  chipTone?: ChipTone;
  title: string;
  date: string;
  dateAccent?: DateTileAccent;
}

/* An event's header, the same on the signed-in page (EventMasthead) and the
   public one a share link opens (SharedEventPage): its kind and the circle
   chip on one line, the title (64px from 960px) and, from 960px, the date as a
   big tile at the right. No hooks, so the public page can stay a Server
   Component. The callers put the wash behind it. */
export function EventHeader({ label, circleName, chipTitle, chipTone, title, date, dateAccent }: EventHeaderProps) {
  return (
    <div className="min-[960px]:grid min-[960px]:grid-cols-[1fr_auto] min-[960px]:items-end min-[960px]:gap-x-12">
      <div className="min-w-0">
        <div className="flex min-w-0 items-start justify-between gap-3 min-[960px]:items-center min-[960px]:justify-start min-[960px]:gap-4">
          <Eyebrow className="shrink-0 pt-1.5 min-[960px]:pt-0">{label}</Eyebrow>
          {/* capped, so a long circle name ends in "…" */}
          {circleName ? (
            <CappedChip max="max-w-[60%]" {...(chipTitle ? { title: chipTitle } : {})} {...(chipTone ? { tone: chipTone } : {})}>
              {circleName}
            </CappedChip>
          ) : (
            <span />
          )}
        </div>
        <h1 className="mt-4 font-sans text-title leading-[0.95] font-extrabold tracking-display wrap-anywhere min-[960px]:text-[64px] min-[960px]:leading-[1.02]">{title}</h1>
      </div>
      <div className="hidden min-[960px]:block">
        <DateTile iso={date} large {...(dateAccent ? { accent: dateAccent } : {})} />
      </div>
    </div>
  );
}
