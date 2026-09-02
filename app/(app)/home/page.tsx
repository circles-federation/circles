"use client";

import { useRouter } from "next/navigation";
import { Home } from "@/components/home/home.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { logout } from "@/lib/auth";
import { useAppNav } from "@/lib/hooks";

export default function Page() {
  const router = useRouter();
  const { profile, events, orgs, rsvpState } = useAppState();
  const nav = useAppNav();
  // "Neighbors" and "Local organizations" both just open the viewer's own
  // Neighborhood Council folder now — see lib/orgs.util.js
  const myCouncil = orgs.find((o) => o.neighborhood === profile.neighborhood);

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
      orgs={orgs}
      rsvpState={rsvpState}
      onOpenEvent={(e) => nav.openEvent(e, "Home")}
      setView={nav.setView}
      onOpenNeighbors={() => myCouncil && nav.openOrg(myCouncil, "Home")}
      onOpenLocalOrgs={() => myCouncil && nav.openOrg(myCouncil, "Home")}
      onPlayGame={() => nav.setView("game")}
      onOpenOrg={(o) => nav.openOrg(o, "Home")}
      onEditProfile={() => nav.setView("editMyself")}
      onLogout={handleLogout}
    />
  );
}
