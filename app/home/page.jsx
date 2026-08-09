"use client";

import { Home } from "@/components/home/home.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { HOME_HOOD } from "@/lib/data";
import { useAppNav } from "@/lib/hooks";

export default function Page() {
  const { profile, events, rsvpState, toggleRsvp, voteState, toggleVote } = useAppState();
  const nav = useAppNav();

  return (
    <Home
      profile={profile}
      events={events}
      rsvpState={rsvpState}
      toggleRsvp={toggleRsvp}
      voteState={voteState}
      toggleVote={toggleVote}
      onOpenEvent={(e) => nav.openEvent(e, "Home")}
      setView={nav.setView}
      onOpenNeighbors={() => nav.openNeighbors(HOME_HOOD)}
      onOpenLocalOrgs={() => nav.openLocalOrgs(HOME_HOOD)}
      onPlayGame={() => nav.setView("game")}
      onOpenOrg={(o) => nav.openOrg(o, "Home")}
      onEditProfile={() => nav.setView("editMyself")}
    />
  );
}
