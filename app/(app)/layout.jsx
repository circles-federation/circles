import { redirect } from "next/navigation";
import { AppShell } from "@/components/shared/app-shell";
import { AppStateProvider } from "@/components/providers/app-state-provider";
import { ProfileModalProvider } from "@/components/providers/profile-modal-provider";
import { getEvents } from "@/lib/db/events";
import { getMemberById } from "@/lib/db/members";
import { getOrgs } from "@/lib/db/orgs";
import { getCurrentUserId } from "@/lib/session";

/* Everything that requires a logged-in member lives under this group.
   proxy.js is the primary gate (it redirects before this ever renders for an
   unauthenticated request) — the check below is defensive, for the case a
   future matcher change loses proxy coverage on some path (see the Next.js
   docs' own warning about this: verify auth inside the route/layout too, not
   just at the proxy). redirect("/") can't loop: "/" is a sibling route
   outside this group and never re-enters this layout. */
export default async function AppLayout({ children }) {
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) redirect("/");

  const [events, orgs, profile] = await Promise.all([
    getEvents(),
    getOrgs(),
    getMemberById(currentUserId),
  ]);

  return (
    <AppStateProvider currentUserId={currentUserId} initialEvents={events} initialOrgs={orgs} initialProfile={profile}>
      <ProfileModalProvider>
        <AppShell>{children}</AppShell>
      </ProfileModalProvider>
    </AppStateProvider>
  );
}
