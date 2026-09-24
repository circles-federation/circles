import { getCircles } from "./circles";
import { getEventsForMember } from "./events";
import { getMembers } from "./members";
import { getResourcesForMember } from "./resources";
import type { Circle, CircleResource, Event, Member } from "@/lib/types";

export interface AppStateData {
  events: Event[];
  circles: Circle[];
  members: Member[];
  resources: CircleResource[];
  profile: Member;
}

/* Everything AppStateProvider holds, as the given member may see it: what
   app/(app)/layout.tsx seeds the app with, and what loadAppStateAction
   reloads it with when the installed app comes back to the foreground — one
   function so the two can't drift apart. Events and resources are both
   scoped to circles: only the ones the member may see are fetched, so nothing
   else reaches their browser. Null if the member no longer exists. */
export async function getAppStateForMember(memberId: number): Promise<AppStateData | null> {
  const [events, circles, members, resources] = await Promise.all([getEventsForMember(memberId), getCircles(), getMembers(), getResourcesForMember(memberId)]);
  const profile = members.find((m) => m.id === memberId);
  return profile ? { events, circles, members, resources, profile } : null;
}
