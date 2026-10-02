import { countPendingApplications } from "./applications";
import { getCirclesForMember } from "./circles";
import { getEventsForMember } from "./events";
import { getInvitationsForMember } from "./invitations";
import { getMembersForViewer, isEmailPublic } from "./members";
import { getResourcesForMember } from "./resources";
import type { Circle, CircleInvitation, CircleResource, Event, Member, Profile } from "@/lib/types";

export interface AppStateData {
  events: Event[];
  circles: Circle[];
  members: Member[];
  resources: CircleResource[];
  // their own invitations, and those to the circles they're in
  invitations: CircleInvitation[];
  // the member themself, with whether they let others see their email
  profile: Profile;
  // applications waiting for review, for a system admin; null for anyone else
  pendingApplications: number | null;
}

/* Everything AppStateProvider holds, as the given member may see it: what
   app/(app)/layout.tsx seeds the app with, and what loadAppStateAction
   reloads it with when the installed app comes back to the foreground — one
   function so the two can't drift apart. Events and resources are both
   scoped to circles: only the ones the member may see are fetched, so nothing
   else reaches their browser. Null if the member no longer exists. */
export async function getAppStateForMember(memberId: number): Promise<AppStateData | null> {
  const [events, circles, members, resources, invitations, pendingApplications] = await Promise.all([
    getEventsForMember(memberId),
    getCirclesForMember(memberId),
    getMembersForViewer(memberId),
    getResourcesForMember(memberId),
    getInvitationsForMember(memberId),
    countPendingApplications(memberId),
  ]);
  const me = members.find((m) => m.id === memberId);
  if (!me) return null;
  const profile: Profile = { ...me, emailPublic: await isEmailPublic(memberId) };
  return { events, circles, members, resources, invitations, profile, pendingApplications };
}
