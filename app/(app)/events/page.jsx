"use client";

import { useRouter } from "next/navigation";
import { EventsList } from "@/components/events/events-list.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useAppNav } from "@/lib/hooks";

export default function Page() {
  const router = useRouter();
  const { events, councilProposals, rsvpState, toggleRsvp, voteState, toggleVote } = useAppState();
  const nav = useAppNav();

  return (
    <EventsList
      events={events}
      councilProposals={councilProposals}
      rsvpState={rsvpState}
      toggleRsvp={toggleRsvp}
      voteState={voteState}
      toggleVote={toggleVote}
      onOpenEvent={nav.openEvent}
      onNewEvent={() => router.push("/events/new")}
    />
  );
}
