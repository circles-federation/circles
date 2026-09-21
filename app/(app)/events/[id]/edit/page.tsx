"use client";

import { Suspense } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import { EventFormPage } from "@/components/events/event-form.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { isEventOrganizer } from "@/lib/governance.util";
import type { EventDetails } from "@/lib/events.util";

function EditEvent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { events, circles, profile, updateEventDetails } = useAppState();

  const event = events.find((e) => e.id === id);
  // only the person hosting an event can edit it (the server enforces this
  // too); anyone else has no edit page to land on
  if (!event || !isEventOrganizer(event, profile)) notFound();

  return (
    <EventFormPage
      mode="edit"
      event={event}
      profile={profile}
      circles={circles}
      // replace, not push: the form is done with, so its history entry
      // should be too — otherwise the back button lands on the now-stale
      // edit form instead of the event itself.
      onSave={async (details: EventDetails) => {
        const result = await updateEventDetails(event.id, details);
        if (result.ok) router.replace(`/events/${event.id}`);
        return result;
      }}
      // back(), not push() — this route is only ever entered from the
      // event's own detail page, so cancelling should return to wherever
      // that push came from rather than stacking a second, redundant
      // detail-page entry (which made the detail page's own Back button
      // land on this now-stale edit form instead).
      onCancel={() => router.back()}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <EditEvent />
    </Suspense>
  );
}
