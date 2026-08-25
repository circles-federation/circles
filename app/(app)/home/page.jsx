"use client";

import { Home } from "@/components/home/home.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useAppNav } from "@/lib/hooks";

export default function Page() {
  const { profile, events, orgs, rsvpState } = useAppState();
  const nav = useAppNav();
  // "Neighbors" and "Local organizations" both just open the viewer's own
  // Neighborhood Council folder now — see lib/orgs.util.js
  const myCouncil = orgs.find((o) => o.neighborhood === profile.neighborhood);

  return (
    <Home
      profile={profile}
      events={events}
      orgs={orgs}
      rsvpState={rsvpState}
      onOpenEvent={(e) => nav.openEvent(e, "Home")}
      setView={nav.setView}
      onOpenNeighbors={() => myCouncil && nav.openOrg(myCouncil, "Home")}
      onOpenLocalOrgs={() => myCouncil && nav.openOrg(myCouncil, "Home")}
      onPlayGame={() => nav.setView("game")}
      onOpenOrg={(o) => nav.openOrg(o, "Home")}
      onEditProfile={() => nav.setView("editMyself")}
    />
  );
}
