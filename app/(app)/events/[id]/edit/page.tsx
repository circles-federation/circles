"use client";

import { Suspense, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import { EventFormPage } from "@/components/events/event-form.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { isEventOrganizer } from "@/lib/governance.util";
import type { EventDetails } from "@/lib/events.util";
import type { Event } from "@/lib/types";

function EditEvent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { events, circles, profile, updateEventDetails, cancelEvent } = useAppState();

  // the event as it was when cancelling began: once it's cancelled it's gone
  // from state (or marked cancelled) a moment before the navigation away
  // lands, so the form keeps showing this rather than flashing the 404 below
  const [cancelling, setCancelling] = useState<Event | null>(null);
  const event = events.find((e) => e.id === id) ?? cancelling ?? undefined;
  // only the person hosting an event can edit it (the server enforces this
  // too); anyone else has no edit page to land on, and nor does a cancelled one
  if (!event || !isEventOrganizer(event, profile) || (event.cancelled && !cancelling)) notFound();

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
      // replace again: to the event, now marked cancelled, or — if no one else
      // was going and it was deleted — to the list, as it has no page any more
      onCancelEvent={async () => {
        setCancelling(event);
        const result = await cancelEvent(event.id);
        if (!result.ok) setCancelling(null);
        if (result.ok) router.replace(result.deleted ? "/events" : `/events/${event.id}`);
        return result.ok ? { ok: true } : result;
      }}
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
