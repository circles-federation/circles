"use client";

import { useRouter } from "next/navigation";
import { NewEventForm } from "@/components/events/new-event-form.page";
import { useAppState } from "@/components/providers/app-state-provider";

export default function Page() {
  const router = useRouter();
  const { createEvent, orgs, profile } = useAppState();

  return (
    <NewEventForm
      profile={profile}
      orgs={orgs}
      // replace, not push: the form is done with, so its history entry should
      // be too — otherwise the new event's back button (router.back()) lands
      // back on the now-stale, already-submitted form instead of /events.
      onCreate={(ev) => { createEvent(ev); router.replace(`/events/${ev.id}`); }}
      onCancel={() => router.push("/events")}
    />
  );
}
