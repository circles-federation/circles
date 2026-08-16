"use client";

import { useMemo, useState } from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import { FloatingActionButton } from "@/components/chrome/floating-action-button";
import { PageHeader } from "@/components/chrome/page-header";
import { SearchWithFilter } from "@/components/chrome/search-with-filter";
import { EventFeed } from "./event-feed";
import { hostInfo } from "@/lib/data";
import { isConfirmed, kindOf } from "@/lib/governance.util";
import { INK, PAPER, TYPE, sans } from "@/lib/theme";

export function EventsList({ events, councilProposals, rsvpState, toggleRsvp, voteState, toggleVote, onOpenEvent, onNewEvent }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(null); // null | "Proposed" | "Confirmed"

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      // status filter applies to governance events (assemblies / council meetings)
      if (status) {
        if (!kindOf(e).governance) return false;
        const confirmed = isConfirmed(e);
        if (status === "Confirmed" && !confirmed) return false;
        if (status === "Proposed" && confirmed) return false;
      }
      if (!q) return true;
      const host = hostInfo(e.host);
      return [e.title, host.label, e.location].join(" ").toLowerCase().includes(q);
    });
  }, [events, query, status]);

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 24px 80px" }}>
      <PageHeader title="Events">
        <button
          onClick={onNewEvent}
          className="btn-invert btn-ink hidden min-[720px]:inline-flex"
          style={{
            fontFamily: sans, fontSize: TYPE.xs, letterSpacing: "0.1em", textTransform: "uppercase",
            fontWeight: 700, cursor: "pointer", padding: "9px 16px",
            border: `1px solid ${INK}`, background: INK, color: PAPER,
            alignItems: "center", gap: 6,
          }}
        >
          <PlusIcon className="size-3.5" strokeWidth={2.5} />
          New Event
        </button>
      </PageHeader>

      {/* bottom clears BottomNav (app/(app) layout only), which the welcome
          page's default offset doesn't need to account for */}
      <FloatingActionButton
        onClick={onNewEvent}
        title="New event"
        icon={<PlusIcon className="size-5" strokeWidth={2} style={{ color: INK }} />}
        bottom={96}
        className="min-[720px]:hidden"
      />

      <SearchWithFilter
        query={query}
        onQuery={setQuery}
        placeholder="Search a title, host, or location"
        filters={[
          { label: "Status", options: ["Proposed", "Confirmed"], active: status, onFilter: setStatus },
        ]}
      />

      <div style={{ marginTop: 28 }}>
        <EventFeed
          events={filtered}
          councilProposals={councilProposals}
          rsvpState={rsvpState}
          toggleRsvp={toggleRsvp}
          voteState={voteState}
          toggleVote={toggleVote}
          onOpenEvent={onOpenEvent}
          emptyText={query || status ? "No events match your search." : "No events yet. Create one to get started."}
        />
      </div>
    </div>
  );
}
