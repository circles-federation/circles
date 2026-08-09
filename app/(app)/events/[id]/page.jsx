"use client";

import { Suspense } from "react";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import { EventPage } from "@/components/events/event.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useProfileModal } from "@/components/providers/profile-modal-provider";
import { useAppNav } from "@/lib/hooks";

function EventDetail() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    events, councilProposals, rsvpState, toggleRsvp, voteState, toggleVote,
    toggleRoleSlot, ratifyCouncilProposal,
  } = useAppState();
  const { open } = useProfileModal();
  const nav = useAppNav();

  const event = events.find((e) => e.id === id);
  if (!event) notFound();

  return (
    <EventPage
      event={event}
      events={events}
      councilProposals={councilProposals}
      rsvpState={rsvpState}
      toggleRsvp={toggleRsvp}
      voteState={voteState}
      toggleVote={toggleVote}
      onBack={() => router.back()}
      backLabel={searchParams.get("from")}
      onOpenMember={open}
      onOpenOrg={(o) => nav.openOrg(o, event.title)}
      onToggleRoleSlot={toggleRoleSlot}
      onOpenEvent={(e) => nav.openEvent(e, event.title)}
      onProposeCouncil={() => router.push(`/events/${event.id}/propose`)}
      onRatifyProposal={ratifyCouncilProposal}
      onProposeEndorsingAssembly={() => router.push(`/events/${event.id}/propose`)}
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
