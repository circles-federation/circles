"use client";

import { EmptyState, LinkRow } from "@/components/shared";
import { DateTile } from "@/components/events/date-tile";
import { useAppState } from "@/components/providers/app-state-provider";
import { isAttending, meetingLink } from "@/lib/events.util";
import { fmtTime, hasEnded, parseDay } from "@/lib/format.util";
import { awaitingConsent } from "@/lib/governance.util";
import { useClock } from "@/lib/hooks";
import type { Event } from "@/lib/types";
import { HomeSection } from "./home-section";

// how many Home shows; the rest are on the Events tab, under Mine
const SHOWN = 3;

// an event you're hosting is one you organized for no circle: a circle's is
// the circle's, so its organizer is going like anyone else
const hosting = (e: Event, memberId: number) => e.organizerId === memberId && !e.hostCircleId;

/* What's next for you: the soonest few events you're going to or hosting,
   not merely everything in your circles (that's the Events tab), each saying
   which. Its link goes to all of yours, past ones included. */
export function UpNext() {
  const { events, profile, rsvpState } = useAppState();
  const now = useClock();
  const mine = events
    .filter((e) => !awaitingConsent(e) && !hasEnded(e, now))
    .filter((e) => hosting(e, profile.id) || isAttending(e, profile.id) || rsvpState[e.id])
    .sort((a, b) => parseDay(a.date).getTime() - parseDay(b.date).getTime() || a.start.localeCompare(b.start))
    .slice(0, SHOWN);

  return (
    <HomeSection label="Up next" more={{ label: "My events", href: "/events?show=mine" }}>
      {mine.length === 0 ? (
        <EmptyState action={{ label: "Browse events", href: "/events" }}>Nothing coming up. Events you’re going to or hosting show up here.</EmptyState>
      ) : (
        <div className="border-t border-ink">
          {mine.map((e) => (
            <LinkRow
              key={e.id}
              href={`/events/${e.id}`}
              image={<DateTile iso={e.date} accent={e.cancelled ? "soft" : "ink"} />}
              title={e.cancelled ? <span className="text-soft line-through">{e.title}</span> : e.title}
              detail={[e.cancelled ? "Cancelled" : hosting(e, profile.id) ? "Hosting" : "Going", fmtTime(e.start), meetingLink(e.location) ? "Online" : e.location].filter(Boolean).join(" · ")}
            />
          ))}
        </div>
      )}
    </HomeSection>
  );
}
