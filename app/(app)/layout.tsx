import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shared";
import { AppStateProvider } from "@/components/providers/app-state-provider";
import { BackHandlerProvider } from "@/components/providers/back-handler-provider";
import { TopBarActionProvider } from "@/components/providers/top-bar-action-provider";
import { getAppStateForMember } from "@/lib/db/app-state";
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

  // the signed-in member always resolves here: currentUserId comes from a
  // valid session, whose user is looked up back to a real member by email
  // (see lib/session.ts).
  const state = await getAppStateForMember(currentUserId);
  if (!state) redirect("/");
  const { events, circles, members, resources, profile, pendingApplications } = state;

  return (
    <AppStateProvider currentUserId={currentUserId} initialEvents={events} initialCircles={circles} initialMembers={members} initialResources={resources} initialProfile={profile} initialPendingApplications={pendingApplications}>
      <BackHandlerProvider>
        <TopBarActionProvider>
          <AppShell>{children}</AppShell>
        </TopBarActionProvider>
      </BackHandlerProvider>
    </AppStateProvider>
  );
}
