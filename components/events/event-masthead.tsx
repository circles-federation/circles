import { DateTile } from "./date-tile";
import { Eyebrow, CappedChip, MastheadGlow } from "@/components/shared";
import { isPastEvent } from "@/lib/format.util";
import { awaitingConsent } from "@/lib/governance.util";
import { useCirclesById } from "@/lib/hooks";
import type { Event } from "@/lib/types";

interface EventMastheadProps {
  event: Event;
}

/* Kind, circle chip and title — the header block every event detail page
   opens with. From 960px the title is larger and the date a big tile at the
   right. Its When and Where (EventFacts) follow it on the page. Editing it
   is the top bar's pencil, for its organizer (see TopBar's pageAction). The
   wash behind it is the page's (MastheadGlow). */
export function EventMasthead({ event: e }: EventMastheadProps) {
  const byId = useCirclesById();
  const circle = byId[e.circleId];
  // a meeting or circle-hosted event still awaiting its circle's consent — a
  // decided one is settled and reads like any other event
  const gov = awaitingConsent(e);
  const past = isPastEvent(e);
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
