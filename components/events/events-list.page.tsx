"use client";

import { useMemo, useState } from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import { Button, FloatingActionButton, PageContainer, PageHeader, SearchWithFilter } from "@/components/shared";
import { EventFeed } from "./event-feed";
import { hostInfo } from "@/lib/data";
import { isConfirmed, kindOf } from "@/lib/governance.util";
import type { CouncilProposal, Event } from "@/lib/types";

type StatusFilter = "Proposed" | "Confirmed" | null;

interface EventsListProps {
  events: Event[];
  councilProposals?: CouncilProposal[];
  onOpenEvent: (e: Event) => void;
  onNewEvent: () => void;
}

export function EventsList({ events, councilProposals, onOpenEvent, onNewEvent }: EventsListProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>(null); // null | "Proposed" | "Confirmed"

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
    <PageContainer size="wide">
      {/* the top bar already shows "Events" as the mobile section name (see
          top-bar.tsx), so this exact-duplicate title — and the "New Event"
          button beside it, already redundant with the FloatingActionButton
          below — is hidden rather than removed, so both still show at
          720px+ where the top bar reverts to the brand link and the FAB
          disappears. */}
      <div className="hidden min-[720px]:block">
        <PageHeader title="Events">
          <Button size="compact" onClick={onNewEvent}>
            <PlusIcon className="size-3.5" strokeWidth={2.5} />
            New Event
          </Button>
        </PageHeader>
      </div>

      {/* bottom clears BottomNav (app/(app) layout only), which the welcome
          page's default offset doesn't need to account for */}
      <FloatingActionButton
        onClick={onNewEvent}
        title="New event"
        icon={<PlusIcon className="size-5 text-ink" strokeWidth={2} />}
        bottom={96}
        className="min-[720px]:hidden"
      />

      {/* mt-5 only once there's something above it to space away from — at
          mobile, with PageHeader hidden, this is the top of the page, and
          PageContainer's own pt-6 already provides the right gap on its own. */}
      <SearchWithFilter
        className="min-[720px]:mt-5"
        query={query}
        onQuery={setQuery}
        placeholder="Search a title, host, or location"
        filters={[
          { label: "Status", options: ["Proposed", "Confirmed"], active: status, onFilter: (v) => setStatus(v as StatusFilter) },
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
    </PageContainer>
  );
}
