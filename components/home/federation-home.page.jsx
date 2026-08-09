"use client";

import { Eyebrow } from "@/components/chrome/eyebrow";
import { ForwardLink } from "@/components/chrome/forward-link";
import { EventFeed } from "@/components/events/event-feed";
import { StatCard } from "./stat-card";
import { MEMBERS, ORGS } from "@/lib/data";
import { isPastEvent, parseDay } from "@/lib/format.util";
import { INK, SOFT, TYPE, sans, serif } from "@/lib/theme";

/* The Providence federation home / dashboard — same layout as the neighborhood
   home, but aggregated across the whole federation. */
export function FederationHome({ events, rsvpState, toggleRsvp, voteState, toggleVote, onOpenEvent, setView }) {
  const neighborhoods = [...new Set(MEMBERS.map((m) => m.neighborhood))];
  const upcoming = [...events].filter((e) => !isPastEvent(e)).sort((a, b) => parseDay(a.date) - parseDay(b.date));
  const councils = upcoming.filter((e) => e.kind === "council"); // federation-level meetings

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "36px 24px 80px" }}>
      {/* masthead */}
      <div style={{ borderTop: `3px solid ${INK}`, borderBottom: `1px solid ${INK}`, paddingTop: 18, paddingBottom: 22 }}>
        <Eyebrow style={{ color: SOFT }}>Federation</Eyebrow>
        <h1 style={{ fontFamily: sans, fontWeight: 800, fontSize: TYPE.hero, letterSpacing: "-0.04em", lineHeight: 0.9, margin: "12px 0 0" }}>Providence</h1>
        <p style={{ fontFamily: serif, fontSize: TYPE.lg, color: "#222", margin: "14px 0 0", maxWidth: "40em", lineHeight: 1.5 }}>
          A federation of neighborhoods across Providence. Here’s everything happening across the commune.
        </p>
      </div>

      {/* stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 16, marginTop: 28 }}>
        <StatCard value={neighborhoods.length} label="Neighborhoods" />
        <StatCard value={ORGS.length} label="Organizations" onClick={() => setView("orgs")} />
        <StatCard value={councils.length} label="Upcoming meetings" onClick={() => setView("events")} />
        <StatCard value={upcoming.length} label="Events on the calendar" onClick={() => setView("events")} />
      </div>

      {/* all events across the federation */}
      <section style={{ marginTop: 48 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Eyebrow style={{ color: SOFT }}>Events</Eyebrow>
          <ForwardLink onClick={() => setView("events")}>All events</ForwardLink>
        </div>
        <EventFeed
          events={events}
          rsvpState={rsvpState}
          toggleRsvp={toggleRsvp}
          voteState={voteState}
          toggleVote={toggleVote}
          onOpenEvent={onOpenEvent}
          pageSize={6}
          topBorder
          emptyText="Nothing on the calendar across the federation right now."
        />
      </section>
    </div>
  );
}
