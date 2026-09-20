"use client";

import { CirclesRootPage } from "@/components/circles/circles-root.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useAppNav } from "@/lib/hooks";

export default function Page() {
  const { circles } = useAppState();
  const nav = useAppNav();

  return <CirclesRootPage circles={circles} onOpenCircle={nav.openCircle} />;
}
