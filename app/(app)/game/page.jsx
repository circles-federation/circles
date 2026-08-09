"use client";

import { useRouter } from "next/navigation";
import { NameGame } from "@/components/game/name-game.page";

export default function Page() {
  const router = useRouter();
  return <NameGame onExit={() => router.push("/home")} />;
}
