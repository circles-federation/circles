"use client";

import { EmptyState, LinkRow } from "@/components/shared";
import { DateTile } from "@/components/events/date-tile";
import { RsvpButton } from "@/components/events/rsvp-button";
import { useAppState } from "@/components/providers/app-state-provider";
import { isAttending, isMyEvent, meetingLink } from "@/lib/events.util";
import { fmtTime, hasEnded, parseDay } from "@/lib/format.util";
import { awaitingConsent } from "@/lib/governance.util";
import { useCirclesById, useClock } from "@/lib/hooks";
import type { Event } from "@/lib/types";
import { HomeSection } from "./home-section";

// how many Home shows; the rest are on the Events tab, under Mine
const SHOWN = 3;
// how many it suggests while you're going to nothing
const SUGGESTED = 2;

// an event you're hosting is one you organized for no circle: a circle's is
// the circle's, so its organizer is Going like anyone else, or Organizing
// if they aren't
const hosting = (e: Event, memberId: number) => e.organizerId === memberId && !e.hostCircleId;

const where = (e: Event) => (meetingLink(e.location) ? "Online" : e.location);

/* What's next for you: the soonest few events you're going to or hosting,
   not merely everything in your circles (that's the Events tab), each saying
   which. Its link goes to all of yours, past ones included. While you're
   going to nothing, it's never a dead end: the next couple of events in
   your circles, each with its RSVP, which moves it up into yours. */
export function UpNext() {
  const { events, profile, rsvpState, toggleRsvp } = useAppState();
  const byId = useCirclesById();
  const now = useClock();
  const upcoming = events
    .filter((e) => !awaitingConsent(e) && !hasEnded(e, now))
    .sort((a, b) => parseDay(a.date).getTime() - parseDay(b.date).getTime() || a.start.localeCompare(b.start));
  const isMine = (e: Event) => isMyEvent(e, profile.id, !!rsvpState[e.id]);
  const mine = upcoming.filter(isMine).slice(0, SHOWN);
  // one date of a repeating event, its soonest, rather than the same thing twice
  const series = new Set<string>();
  const suggested = mine.length === 0
    ? upcoming
        .filter((e) => !isMine(e) && !e.cancelled)
        .filter((e) => !e.repeat || (!series.has(e.repeat.seriesId) && !!series.add(e.repeat.seriesId)))
        .slice(0, SUGGESTED)
    : [];

  return (
    <HomeSection label="Up next" more={{ label: "My events", href: "/events?show=mine" }}>
      {mine.length > 0 ? (
        <div className="border-t border-ink">
          {mine.map((e) => (
            <LinkRow
              key={e.id}
              href={`/events/${e.id}`}
              image={<DateTile iso={e.date} accent={e.cancelled ? "soft" : "ink"} />}
              title={e.cancelled ? <span className="text-soft line-through">{e.title}</span> : e.title}
              detail={[e.cancelled ? "Cancelled" : hosting(e, profile.id) ? "Hosting" : isAttending(e, profile.id) || rsvpState[e.id] ? "Going" : "Organizing", fmtTime(e.start), where(e)].filter(Boolean).join(" · ")}
            />
          ))}
        </div>
      ) : suggested.length > 0 ? (
        <>
          <p className="m-0 mb-3 font-serif text-base text-soft">You’re not going to anything yet. Coming up in your circles:</p>
          <div className="border-t border-ink">
            {suggested.map((e) => (
              <LinkRow
                key={e.id}
                href={`/events/${e.id}`}
                image={<DateTile iso={e.date} />}
                title={e.title}
                detail={[byId[e.circleId]?.name, fmtTime(e.start), where(e)].filter(Boolean).join(" · ")}
                // one with roles is signed up for on its page, a role at a time
                {...(e.roles && e.roles.length > 0 ? {} : { trailing: <RsvpButton going={false} onToggle={() => toggleRsvp(e.id)} /> })}
              />
            ))}
          </div>
        </>
      ) : (
        <EmptyState action={{ label: "Browse events", href: "/events" }}>Nothing coming up. Events you’re going to or hosting show up here.</EmptyState>
      )}
    </HomeSection>
  );
}
