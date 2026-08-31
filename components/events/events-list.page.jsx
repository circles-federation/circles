"use client";

import { useMemo, useState } from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import { Button, FloatingActionButton, PageHeader, SearchWithFilter } from "@/components/shared";
import { EventFeed } from "./event-feed";
import { hostInfo } from "@/lib/data";
import { isConfirmed, kindOf } from "@/lib/governance.util";

export function EventsList({ events, councilProposals, onOpenEvent, onNewEvent }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(null); // null | "Proposed" | "Confirmed"

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      // status filter applies to governance events (meetings / council meetings)
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
    <div className="mx-auto max-w-270 px-6 pt-10 pb-20">
      <PageHeader title="Events">
        {/* wrapped rather than putting "hidden min-[720px]:inline-flex" on
            Button's own className — Button already carries an unconditional
            inline-flex, and stacking a conflicting "hidden" alongside it
            would be a base-state coin flip (Tailwind resolves same-specificity
            display utilities by generated-CSS order, not JSX order) */}
        <span className="hidden min-[720px]:block">
          <Button size="compact" onClick={onNewEvent}>
            <PlusIcon className="size-3.5" strokeWidth={2.5} />
            New Event
          </Button>
        </span>
      </PageHeader>

      {/* bottom clears BottomNav (app/(app) layout only), which the welcome
          page's default offset doesn't need to account for */}
      <FloatingActionButton
        onClick={onNewEvent}
        title="New event"
        icon={<PlusIcon className="size-5 text-ink" strokeWidth={2} />}
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

      <div className="mt-7">
        <EventFeed
          events={filtered}
          councilProposals={councilProposals}
          onOpenEvent={onOpenEvent}
          emptyText={query || status ? "No events match your search." : "No events yet. Create one to get started."}
        />
      </div>
    </div>
  );
}
