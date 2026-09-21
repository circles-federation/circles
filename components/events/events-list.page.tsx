"use client";

import { useMemo, useState } from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import { Button, FloatingActionButton, PageContainer, PageHeader, SearchWithFilter } from "@/components/shared";
import { EventFeed } from "./event-feed";
import { isConfirmed, isGoverned } from "@/lib/governance.util";
import { useCirclesById, useMemberById } from "@/lib/hooks";
import type { Event } from "@/lib/types";

type StatusFilter = "Proposed" | "Confirmed" | null;

interface EventsListProps {
  events: Event[];
  onOpenEvent: (e: Event) => void;
  onNewEvent: () => void;
}

export function EventsList({ events, onOpenEvent, onNewEvent }: EventsListProps) {
  const byId = useCirclesById();
  const memberById = useMemberById();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>(null); // null | "Proposed" | "Confirmed"

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      // status filter applies to events that go to a vote (meetings, and
      // events a circle hosts)
      if (status) {
        if (!isGoverned(e)) return false;
        const confirmed = isConfirmed(e, byId);
        if (status === "Confirmed" && !confirmed) return false;
        if (status === "Proposed" && confirmed) return false;
      }
      if (!q) return true;
      const host = memberById(e.organizerId);
      return [e.title, host?.name ?? "", byId[e.circleId]?.name ?? "", byId[e.hostCircleId ?? ""]?.name ?? "", e.location].join(" ").toLowerCase().includes(q);
    });
  }, [events, query, status, byId, memberById]);

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
        placeholder="Search a title, host, circle, or location"
        filters={[
          { label: "Status", options: ["Proposed", "Confirmed"], active: status, onFilter: (v) => setStatus(v as StatusFilter) },
        ]}
      />

      <div className="mt-7">
        <EventFeed
          events={filtered}
          onOpenEvent={onOpenEvent}
          emptyText={query || status ? "No events match your search." : "No events yet. Create one to get started."}
        />
      </div>
    </PageContainer>
  );
}
