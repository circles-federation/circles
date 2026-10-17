"use client";

import { useMemo, useState } from "react";
import { PageContainer, SearchWithFilter } from "@/components/shared";
import { EventFeed } from "./event-feed";
import { isMeeting } from "@/lib/governance.util";
import { useCirclesById, useMemberById } from "@/lib/hooks";
import type { Event } from "@/lib/types";

// nothing undecided is listed (it's a proposal until its circle consents), so
// what's left to filter by is the kind
type TypeFilter = "Events" | "Meetings" | null;

interface EventsListProps {
  events: Event[];
  onOpenEvent: (e: Event) => void;
}

export function EventsList({ events, onOpenEvent }: EventsListProps) {
  const byId = useCirclesById();
  const memberById = useMemberById();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TypeFilter>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (type === "Meetings" && !isMeeting(e)) return false;
      if (type === "Events" && isMeeting(e)) return false;
      if (!q) return true;
      const host = memberById(e.organizerId);
      return [e.title, host?.name ?? "", byId[e.circleId]?.name ?? "", byId[e.hostCircleId ?? ""]?.name ?? "", e.location].join(" ").toLowerCase().includes(q);
    });
  }, [events, query, type, byId, memberById]);

  return (
    // creating an event is the top bar's page action (TopBar's PAGE_ACTIONS)
    <PageContainer size="wide">
      <SearchWithFilter
        query={query}
        onQuery={setQuery}
        placeholder="Search a title, host, circle, or location"
        filters={[
          { label: "Type", options: ["Events", "Meetings"], active: type, onFilter: (v) => setType(v as TypeFilter) },
        ]}
      />

      <div className="mt-7">
        <EventFeed
          events={filtered}
          onOpenEvent={onOpenEvent}
          emptyText={query || type ? "No events match your search." : "No events yet. They appear here as people in your circles create them."}
          {...(query || type ? {} : { emptyAction: { label: "Create an event", href: "/events/new" } })}
        />
      </div>
    </PageContainer>
  );
}
