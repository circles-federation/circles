"use client";

import { useRouter } from "next/navigation";
import { EventsList } from "@/components/events/events-list.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useAppNav } from "@/lib/hooks";

export default function Page() {
  const router = useRouter();
  const { events, councilProposals } = useAppState();
  const nav = useAppNav();

  return (
    <EventsList
      events={events}
      councilProposals={councilProposals}
      onOpenEvent={nav.openEvent}
      onNewEvent={() => router.push("/events/new")}
    />
  );
}
