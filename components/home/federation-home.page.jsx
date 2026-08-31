"use client";

import { Eyebrow, ForwardLink } from "@/components/shared";
import { EventFeed } from "@/components/events/event-feed";
import { StatCard } from "./stat-card";
import { MEMBERS, ORGS } from "@/lib/data";
import { isPastEvent, parseDay } from "@/lib/format.util";

/* The Providence federation home / dashboard — same layout as the neighborhood
   home, but aggregated across the whole federation. */
export function FederationHome({ events, onOpenEvent, setView }) {
  const neighborhoods = [...new Set(MEMBERS.map((m) => m.neighborhood))];
  const upcoming = [...events].filter((e) => !isPastEvent(e)).sort((a, b) => parseDay(a.date) - parseDay(b.date));
  const councils = upcoming.filter((e) => e.kind === "council"); // federation-level meetings

  return (
    <div className="mx-auto max-w-270 px-6 pt-9 pb-20">
      {/* masthead */}
      <div className="border-t-[3px] border-t-ink border-b border-b-ink pt-4.5 pb-5.5">
        <Eyebrow className="text-soft">Federation</Eyebrow>
        <h1 className="mt-3 font-sans text-hero font-extrabold tracking-[-0.04em] leading-[0.9]">Providence</h1>
        <p className="mt-3.5 max-w-[40em] font-serif text-lg leading-normal text-[#222]">
          A federation of neighborhoods across Providence.<br />Here’s everything happening across the city.
        </p>
      </div>

      {/* stat cards */}
      <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-4">
        <StatCard value={neighborhoods.length} label="Neighborhoods" />
        <StatCard value={ORGS.length} label="Organizations" onClick={() => setView("orgs")} />
        <StatCard value={councils.length} label="Upcoming meetings" onClick={() => setView("events")} />
        <StatCard value={upcoming.length} label="Events on the calendar" onClick={() => setView("events")} />
      </div>

      {/* all events across the federation */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <Eyebrow className="text-soft">Events</Eyebrow>
          <ForwardLink onClick={() => setView("events")}>All events</ForwardLink>
        </div>
        <div className="mt-3.5">
          <EventFeed
            events={events}
            onOpenEvent={onOpenEvent}
            pageSize={6}
            emptyText="Nothing on the calendar across the federation right now."
          />
        </div>
      </section>
    </div>
  );
}
