import { countPendingReviews } from "./photo-reviews";
import { getCirclesForMember } from "./circles";
import { getEventsForMember } from "./events";
import { getInvitationsForMember } from "./invitations";
import { getMembersForViewer, getOwnSettings } from "./members";
import { getProposalsForMember } from "./proposals";
import { getResourcesForMember } from "./resources";
import type { Circle, CircleInvitation, CircleProposal, CircleResource, Event, Member, Profile } from "@/lib/types";

export interface AppStateData {
  events: Event[];
  circles: Circle[];
  members: Member[];
  resources: CircleResource[];
  // their own invitations, and those to the circles they're in
  invitations: CircleInvitation[];
  // the proposals of their circles: open ones, and those decided lately
  proposals: CircleProposal[];
  // the member themself, with whether they let others see their email
  profile: Profile;
  // what's waiting for a system admin's review (applications and new
  // photos); null for anyone else
  pendingReviews: number | null;
}

/* Everything AppStateProvider holds, as the given member may see it: what
   app/(app)/layout.tsx seeds the app with, and what loadAppStateAction
   reloads it with when the installed app comes back to the foreground — one
   function so the two can't drift apart. Events and resources are both
   scoped to circles: only the ones the member may see are fetched, so nothing
   else reaches their browser. Null if the member no longer exists. */
export async function getAppStateForMember(memberId: number): Promise<AppStateData | null> {
  const [events, circles, members, resources, invitations, proposals, pendingReviews] = await Promise.all([
    getEventsForMember(memberId),
    getCirclesForMember(memberId),
    getMembersForViewer(memberId),
    getResourcesForMember(memberId),
    getInvitationsForMember(memberId),
    getProposalsForMember(memberId),
    countPendingReviews(memberId),
  ]);
  const me = members.find((m) => m.id === memberId);
  if (!me) return null;
  const profile: Profile = { ...me, ...(await getOwnSettings(memberId)) };
  return { events, circles, members, resources, invitations, proposals, profile, pendingReviews };
}
