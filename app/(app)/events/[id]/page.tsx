"use client";

import { Suspense } from "react";
import { notFound, useParams } from "next/navigation";
import { EventPage } from "@/components/events/event.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useAppNav } from "@/lib/hooks";

function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const {
    events, rsvpState, toggleRsvp, voteState, toggleVote,
    toggleRoleSlot, profile,
  } = useAppState();
  const nav = useAppNav();

  const event = events.find((e) => e.id === id);
  if (!event) notFound();

  return (
    <EventPage
      event={event}
      profile={profile}
      rsvpState={rsvpState}
      toggleRsvp={toggleRsvp}
      voteState={voteState}
      toggleVote={toggleVote}
      onOpenMember={nav.openMember}
      onOpenCircle={(c) => nav.openCircle(c)}
      onToggleRoleSlot={toggleRoleSlot}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <EventDetail />
    </Suspense>
  );
}
