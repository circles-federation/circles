"use client";

import { FederationHome } from "@/components/home/federation-home.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useAppNav } from "@/lib/hooks";

export default function Page() {
  const { events, rsvpState, toggleRsvp, voteState, toggleVote } = useAppState();
  const nav = useAppNav();

  return (
    <FederationHome
      events={events}
      rsvpState={rsvpState}
      toggleRsvp={toggleRsvp}
      voteState={voteState}
      toggleVote={toggleVote}
      onOpenEvent={(e) => nav.openEvent(e, "Federation")}
      setView={nav.setView}
    />
  );
}
