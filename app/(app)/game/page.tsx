"use client";

import { useRouter } from "next/navigation";
import { NameGamePage } from "@/components/game/name-game.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useMembers } from "@/lib/hooks";

export default function Page() {
  const router = useRouter();
  const members = useMembers();
  const { profile } = useAppState();
  return <NameGamePage members={members} profile={profile} onExit={() => router.push("/home")} />;
}
