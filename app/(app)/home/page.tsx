"use client";

import { useRouter } from "next/navigation";
import { Home } from "@/components/home/home.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { logout } from "@/lib/auth";
import { useAppNav } from "@/lib/hooks";

export default function Page() {
  const router = useRouter();
  const { profile, events, circles, rsvpState } = useAppState();
  const nav = useAppNav();
  // "Neighbors" and "Local circles" both just open the viewer's own
  // neighborhood folder — pre-filtered to the relevant Type(s) so there's
  // nothing left to click once they land.
  const myNeighborhood = circles.find((c) => c.id === profile.homeCircleId);

  // the action itself is pure (sets/clears a cookie, doesn't navigate) —
  // matching this app's convention that mutators never navigate — so the
  // caller does the redirect once it resolves. Moved here from top-bar.jsx
  // so logout is reachable on mobile too, not just the desktop nav bar.
  async function handleLogout() {
    await logout();
    router.push("/");
  }

  return (
    <Home
      profile={profile}
      events={events}
      circles={circles}
      rsvpState={rsvpState}
      onOpenEvent={(e) => nav.openEvent(e, "Home")}
      setView={nav.setView}
      onOpenNeighbors={() => myNeighborhood && nav.openCircle(myNeighborhood, "Home", ["People"])}
      onOpenLocalCircles={() => myNeighborhood && nav.openCircle(myNeighborhood, "Home", ["Councils", "Organizations"])}
      onPlayGame={() => nav.setView("game")}
      onOpenCircle={(c) => nav.openCircle(c, "Home")}
      onEditProfile={() => nav.setView("editMyself")}
      onLogout={handleLogout}
    />
  );
}
