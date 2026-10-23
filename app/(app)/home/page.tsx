"use client";

import { Home } from "@/components/home/home.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useAppNav } from "@/lib/hooks";

export default function Page() {
  const { profile, events, circles, rsvpState } = useAppState();
  const nav = useAppNav();
  // "Neighbors" and "Local circles" both just open the viewer's own
  // neighborhood folder — pre-filtered to the relevant Type(s) so there's
  // nothing left to click once they land.
  const myNeighborhood = circles.find((c) => c.id === profile.homeCircleId);

  return (
    <Home
      profile={profile}
      events={events}
      circles={circles}
      rsvpState={rsvpState}
      onOpenNeighbors={() => myNeighborhood && nav.openCircle(myNeighborhood, ["People"])}
      onOpenLocalCircles={() => myNeighborhood && nav.openCircle(myNeighborhood, ["Circles", "Organizations"])}
      onPlayGame={() => nav.setView("game")}
    />
  );
}
