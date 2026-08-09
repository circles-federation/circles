"use client";

import { useRouter } from "next/navigation";
import { NewEventForm } from "@/components/events/new-event-form.page";
import { useAppState } from "@/components/providers/app-state-provider";

export default function Page() {
  const router = useRouter();
  const { createEvent } = useAppState();

  return (
    <NewEventForm
      onCreate={(ev) => { createEvent(ev); router.push(`/events/${ev.id}`); }}
      onCancel={() => router.push("/events")}
    />
  );
}
