"use client";

import { EventsList } from "@/components/events/events-list.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useAppNav } from "@/lib/hooks";

export default function Page() {
  const { events } = useAppState();
  const nav = useAppNav();

  return <EventsList events={events} onOpenEvent={nav.openEvent} />;
}
