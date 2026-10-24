"use client";

import { useSyncExternalStore } from "react";
import { HiNeighborPage } from "@/components/game/hi-neighbor.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useGoBack } from "@/components/providers/back-handler-provider";
import { EmptyState, PageContainer } from "@/components/shared";
import { useMembers } from "@/lib/hooks";

const noSubscribe = () => () => {};

// Hi, neighbor, played from your own neighborhood's page, so that's where it
// goes back to when there's no page behind it (opened by a link, or reloaded)
export default function Page() {
  const members = useMembers();
  const { profile } = useAppState();
  const home = profile.homeCircleId ? `/circles/${profile.homeCircleId}` : "/circles";
  const goBack = useGoBack(home);
  // a game is shuffled, so it's dealt in the browser only: dealt on the
  // server as well, the two wouldn't match
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);

  // it quizzes you on everyone in your neighborhood but you; the menu only
  // offers it once there's someone, but the URL can still be opened
  if (!members.some((m) => profile.homeCircleId !== null && m.homeCircleId === profile.homeCircleId && m.id !== profile.id)) {
    return (
      <PageContainer size="normal">
        <EmptyState action={{ label: profile.homeCircleId ? "Your neighborhood" : "Browse circles", href: home }}>No neighbors to meet yet. Hi, neighbor is ready once someone else lives in your neighborhood.</EmptyState>
      </PageContainer>
    );
  }
  if (!inBrowser) return null;
  return <HiNeighborPage members={members} profile={profile} onExit={goBack} />;
}
