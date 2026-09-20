"use client";

import { useRouter } from "next/navigation";
import { EventFormPage } from "@/components/events/event-form.page";
import { useAppState } from "@/components/providers/app-state-provider";
import type { Event } from "@/lib/types";

export default function Page() {
  const router = useRouter();
  const { createEvent, circles, profile } = useAppState();

  return (
    <EventFormPage
      mode="create"
      profile={profile}
      circles={circles}
      // replace, not push: the form is done with, so its history entry should
      // be too — otherwise the new event's back button (router.back()) lands
      // back on the now-stale, already-submitted form instead of /events.
      onCreate={(ev: Event) => { createEvent(ev); router.replace(`/events/${ev.id}`); }}
      onCancel={() => router.push("/events")}
    />
  );
}
