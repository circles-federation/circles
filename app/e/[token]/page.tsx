import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SharedEventPage } from "@/components/events/shared-event.page";
import { getSharedEvent } from "@/lib/db/event-shares";
import { getVisibleEvent } from "@/lib/db/events";
import { findGuestRsvp } from "@/lib/db/guest-rsvps";
import { GUEST_COOKIE, guestIdsFrom } from "@/lib/guest-rsvp.util";
import { getCurrentUserId } from "@/lib/session";

// the link is the secret: keep the page out of search results, and don't pass
// it on to sites it links to
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

// an event someone shared, for people without an account (proxy.ts lets /e/
// through). A member who can see the event is sent to its page in the app.
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const event = await getSharedEvent(token);
  if (!event) notFound();

  const memberId = await getCurrentUserId();
  if (memberId && (await getVisibleEvent(memberId, event.eventId))) redirect(`/events/${event.eventId}`);

  const guest = await findGuestRsvp(guestIdsFrom((await cookies()).get(GUEST_COOKIE)?.value), event.eventId);
  return <SharedEventPage event={event} guest={guest} />;
}
