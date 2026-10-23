"use client";

import { useSearchParams } from "next/navigation";
import { EventsList } from "@/components/events/events-list.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useAppNav } from "@/lib/hooks";

export default function Page() {
  const { events, profile, rsvpState } = useAppState();
  const nav = useAppNav();
  // Home's My events opens this showing only yours
  const mine = useSearchParams().get("show") === "mine";

  return <EventsList events={events} onOpenEvent={nav.openEvent} memberId={profile.id} rsvpState={rsvpState} initialShow={mine ? "Mine" : null} />;
}
