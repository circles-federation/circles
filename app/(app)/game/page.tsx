"use client";

import { useGoBack } from "@/components/providers/back-handler-provider";
import { NameGamePage } from "@/components/game/name-game.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useMembers } from "@/lib/hooks";

export default function Page() {
  const goBack = useGoBack();
  const members = useMembers();
  const { profile } = useAppState();
  return <NameGamePage members={members} profile={profile} onExit={goBack} />;
}
