import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StopEmailsPage } from "@/components/events/stop-emails.page";
import { getGuestForStopPage } from "@/lib/db/guest-rsvps";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

// the link at the foot of a guest's emails. Opening it changes nothing (mail
// scanners open links): the buttons on the page do.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guest = await getGuestForStopPage(id);
  if (!guest) notFound();
  return <StopEmailsPage id={id} title={guest.title} token={guest.token} stopped={guest.stopped} />;
}
