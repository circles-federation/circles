import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shared";
import { AppStateProvider } from "@/components/providers/app-state-provider";
import { BackHandlerProvider } from "@/components/providers/back-handler-provider";
import { ProfileModalProvider } from "@/components/providers/profile-modal-provider";
import { getCircles } from "@/lib/db/circles";
import { getEventsForMember } from "@/lib/db/events";
import { getMembers } from "@/lib/db/members";
import { getResourcesForMember } from "@/lib/db/resources";
import { getCurrentUserId } from "@/lib/session";

/* Everything that requires a logged-in member lives under this group.
   proxy.js is the primary gate (it redirects before this ever renders for an
   unauthenticated request) — the check below is defensive, for the case a
   future matcher change loses proxy coverage on some path (see the Next.js
   docs' own warning about this: verify auth inside the route/layout too, not
   just at the proxy). redirect("/") can't loop: "/" is a sibling route
   outside this group and never re-enters this layout. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) redirect("/");

  // events and resources are both scoped to circles: only the ones the
  // signed-in member may see are fetched, so nothing else reaches their browser
  const [events, circles, members, resources] = await Promise.all([getEventsForMember(currentUserId), getCircles(), getMembers(), getResourcesForMember(currentUserId)]);
  // the signed-in member always resolves here: currentUserId comes from a
  // valid session, whose user is looked up back to a real member by email
  // (see lib/session.ts).
  const profile = members.find((m) => m.id === currentUserId);
  if (!profile) redirect("/");

  return (
    <AppStateProvider currentUserId={currentUserId} initialEvents={events} initialCircles={circles} initialMembers={members} initialResources={resources} initialProfile={profile}>
      <ProfileModalProvider>
        <BackHandlerProvider>
          <AppShell>{children}</AppShell>
        </BackHandlerProvider>
      </ProfileModalProvider>
    </AppStateProvider>
  );
}
