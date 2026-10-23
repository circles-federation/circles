import type { Metadata } from "next";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SharedEventPage } from "@/components/events/shared-event.page";
import { getSharedEvent } from "@/lib/db/event-shares";
import { getVisibleEvent } from "@/lib/db/events";
import { findGuestRsvp } from "@/lib/db/guest-rsvps";
import { GUEST_COOKIE, guestIdsFrom } from "@/lib/guest-rsvp.util";
import { meetingLink } from "@/lib/events.util";
import { fmtEventWhen } from "@/lib/format.util";
import { getCurrentUserId } from "@/lib/session";

// the same event is read by the page and by its preview, in one request
const loadEvent = cache(getSharedEvent);

const appUrl = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

/* What a link preview says (iMessage, WhatsApp, Slack read these when the link
   is pasted into a message), so the person it's sent to knows what to expect
   before opening it: the event, when, where, and who invited them. The preview
   image is opengraph-image.tsx. The link is the secret, so the page stays out
   of search results, and doesn't pass itself on to sites it links to. */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const event = await loadEvent(token);
  const base: Metadata = { metadataBase: new URL(appUrl), robots: { index: false, follow: false }, referrer: "no-referrer" };
  if (!event) return base;
  const title = event.cancelled ? `Cancelled: ${event.title}` : event.title;
  const place = meetingLink(event.location) ? "Online" : event.location;
  const description = event.cancelled
    ? "This event has been cancelled."
    : event.ended
      ? "This event has ended."
      : `${event.sharedBy} invited you · ${fmtEventWhen(event)} · ${place}`;
  return {
    ...base,
    title,
    description,
    openGraph: { type: "website", siteName: "Circles", title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export const dynamic = "force-dynamic";

// an event someone shared, for people without an account (proxy.ts lets /e/
// through). A member who can see the event is sent to its page in the app.
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const event = await loadEvent(token);
  if (!event) notFound();

  const memberId = await getCurrentUserId();
  if (memberId && (await getVisibleEvent(memberId, event.eventId))) redirect(`/events/${event.eventId}`);

  const guest = await findGuestRsvp(guestIdsFrom((await cookies()).get(GUEST_COOKIE)?.value), event.eventId);
  return <SharedEventPage event={event} guest={guest} />;
}
