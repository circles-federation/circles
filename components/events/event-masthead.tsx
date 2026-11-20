import { EventHeader } from "./event-header";
import { MastheadGlow } from "@/components/shared";
import { awaitingConsent, eventNoun } from "@/lib/governance.util";
import { useCirclesById, useEventEnded } from "@/lib/hooks";
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
  // the same moment the page stops taking RSVPs and says who went
  const past = useEventEnded(e);
  const govLabel = gov && <span className="text-flame-text">Proposed</span>;
  const noun = eventNoun(e);

  return (
    <div className="relative isolate pb-6 min-[960px]:pt-4">
      <MastheadGlow />
      <EventHeader
        label={govLabel || (past ? `Past ${noun}` : noun[0]!.toUpperCase() + noun.slice(1))}
        circleName={circle?.name}
        chipTitle={circle ? `${circle.name}: who can see this ${noun}` : ""}
        title={e.title}
        date={e.date}
        dateAccent={gov ? "flame" : "ink"}
      />
    </div>
  );
}
