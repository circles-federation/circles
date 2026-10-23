"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EventsList } from "@/components/events/events-list.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useAppNav } from "@/lib/hooks";

function EventsRoute() {
  const { events, profile, rsvpState } = useAppState();
  const nav = useAppNav();
  const router = useRouter();
  // the Show filter lives in the URL, so Home's My events opens it already
  // showing yours, and the Events tab (plain /events) shows everything
  const show = useSearchParams().get("show") === "mine" ? "Mine" : null;

  return (
    <EventsList
      events={events}
      onOpenEvent={nav.openEvent}
      memberId={profile.id}
      rsvpState={rsvpState}
      show={show}
      onShow={(v) => router.replace(v === "Mine" ? "/events?show=mine" : "/events", { scroll: false })}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <EventsRoute />
    </Suspense>
  );
}
