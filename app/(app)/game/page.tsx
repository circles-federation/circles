"use client";

import { NameGamePage } from "@/components/game/name-game.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useGoBack } from "@/components/providers/back-handler-provider";
import { EmptyState, PageContainer } from "@/components/shared";
import { useMembers } from "@/lib/hooks";

// played from your own neighborhood's page, so that's where it goes back to
// when there's no page behind it (opened by a link, or reloaded)
export default function Page() {
  const members = useMembers();
  const { profile } = useAppState();
  const home = profile.homeCircleId ? `/circles/${profile.homeCircleId}` : "/circles";
  const goBack = useGoBack(home);

  // the game quizzes you on everyone in your neighborhood but you; its card
  // only shows once there's someone, but the URL can still be opened
  if (!members.some((m) => profile.homeCircleId !== null && m.homeCircleId === profile.homeCircleId && m.id !== profile.id)) {
    return (
      <PageContainer size="normal">
        <EmptyState action={{ label: profile.homeCircleId ? "Your neighborhood" : "Browse circles", href: home }}>No neighbors to learn yet. The game is ready once someone else lives in your neighborhood.</EmptyState>
      </PageContainer>
    );
  }
  return <NameGamePage members={members} profile={profile} onExit={goBack} />;
}
