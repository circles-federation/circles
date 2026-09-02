"use client";

import { useRouter } from "next/navigation";
import { NameGamePage } from "@/components/game/name-game.page";

export default function Page() {
  const router = useRouter();
  return <NameGamePage onExit={() => router.push("/home")} />;
}
