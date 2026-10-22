import { cookies } from "next/headers";
import { ApplyPage } from "@/components/welcome/apply.page";
import { getNeighborhoodsForApplying } from "@/lib/db/applications";
import { getVerifiedGuest } from "@/lib/db/guest-rsvps";
import { GUEST_COOKIE, guestIdsFrom } from "@/lib/guest-rsvp.util";

// the neighborhoods are read per request, so a new one is offered at once
export const dynamic = "force-dynamic";

/* Applying to join — public, like the welcome page (proxy.ts lets it through).
   Arriving from an event's share page after RSVPing (?guest=<their RSVP>), it's
   started for them: their name and the email they proved are filled in, and the
   email can't be changed, since it's what the RSVP was confirmed for. The RSVP
   only counts if this browser holds it (its cookie), so a link passed on gets
   nothing. */
export default async function Page({ searchParams }: { searchParams: Promise<{ guest?: string }> }) {
  const { guest: guestId } = await searchParams;
  const guest = guestId ? await getVerifiedGuest(guestIdsFrom((await cookies()).get(GUEST_COOKIE)?.value), guestId) : null;
  const [firstName = "", ...rest] = guest ? guest.name.trim().split(/\s+/) : [];
  return (
    <ApplyPage
      neighborhoods={await getNeighborhoodsForApplying()}
      {...(guest ? { guest: { id: guest.id, firstName, lastName: rest.join(" "), email: guest.email } } : {})}
    />
  );
}
