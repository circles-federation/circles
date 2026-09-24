"use client";

import { useMemo, useState } from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import { FloatingActionButton, PageContainer, SearchWithFilter } from "@/components/shared";
import { EventFeed } from "./event-feed";
import { isApproved, isGoverned } from "@/lib/governance.util";
import { useCirclesById, useMemberById } from "@/lib/hooks";
import type { Event } from "@/lib/types";

type StatusFilter = "Proposed" | "Approved" | null;

interface EventsListProps {
  events: Event[];
  onOpenEvent: (e: Event) => void;
  onNewEvent: () => void;
}

export function EventsList({ events, onOpenEvent, onNewEvent }: EventsListProps) {
  const byId = useCirclesById();
  const memberById = useMemberById();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>(null); // null | "Proposed" | "Approved"

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      // status filter applies to events that go to a vote (meetings, and
      // events a circle hosts)
      if (status) {
        if (!isGoverned(e)) return false;
        const approved = isApproved(e, byId);
        if (status === "Approved" && !approved) return false;
        if (status === "Proposed" && approved) return false;
      }
      if (!q) return true;
      const host = memberById(e.organizerId);
      return [e.title, host?.name ?? "", byId[e.circleId]?.name ?? "", byId[e.hostCircleId ?? ""]?.name ?? "", e.location].join(" ").toLowerCase().includes(q);
    });
  }, [events, query, status, byId, memberById]);

  return (
    <PageContainer size="wide">
      {/* mobile only: at 720px+ New Event is in the top bar's nav instead.
          bottom clears BottomNav (app/(app) layout only), which the welcome
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
        placeholder="Search a title, host, circle, or location"
        filters={[
          { label: "Status", options: ["Proposed", "Approved"], active: status, onFilter: (v) => setStatus(v as StatusFilter) },
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
