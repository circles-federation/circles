"use client";

import { Suspense } from "react";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import { EventPage } from "@/components/events/event.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useProfileModal } from "@/components/providers/profile-modal-provider";
import { useAppNav } from "@/lib/hooks";

function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    events, rsvpState, toggleRsvp, voteState, toggleVote,
    toggleRoleSlot, profile,
  } = useAppState();
  const { open } = useProfileModal();
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
      onBack={() => router.back()}
      backLabel={searchParams.get("from") || undefined}
      onOpenMember={open}
      onOpenCircle={(c) => nav.openCircle(c, event.title)}
      onToggleRoleSlot={toggleRoleSlot}
      onEditEvent={() => router.push(`/events/${event.id}/edit`)}
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
