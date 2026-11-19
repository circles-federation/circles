import { EventHeader } from "./event-header";
import { MastheadGlow } from "@/components/shared";
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
    <div className="relative isolate pb-6 min-[960px]:pt-4">
      <MastheadGlow />
      <EventHeader
        label={govLabel || (past ? "Past event" : "Event")}
        circleName={circle?.name}
        chipTitle={circle ? `${circle.name}: who can see this event` : ""}
        title={e.title}
        date={e.date}
        dateAccent={gov ? "flame" : "ink"}
      />
    </div>
  );
}
