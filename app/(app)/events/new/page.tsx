"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EventFormPage } from "@/components/events/event-form.page";
import { useAppState } from "@/components/providers/app-state-provider";
import type { EventDraft } from "@/lib/events.util";

function NewEventRoute() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { createEvent, circles, profile } = useAppState();

  return (
    <EventFormPage
      mode="create"
      profile={profile}
      circles={circles}
      // ?host= comes from a circle page's Events tab; the form ignores a
      // circle the person can't host from
      initialHostCircleId={searchParams.get("host") ?? undefined}
      // replace, not push: the form is done with, so its history entry should
      // be too — otherwise the new event's back button (router.back()) lands
      // back on the now-stale, already-submitted form instead of /events. The
      // result goes back to the form so a server refusal shows inline.
      onCreate={async (draft: EventDraft) => {
        const result = await createEvent(draft);
        if (result.ok) router.replace(`/events/${result.event.id}`);
        return result;
      }}
      onCancel={() => router.push("/events")}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <NewEventRoute />
    </Suspense>
  );
}
