"use client";

import { CirclesRootPage } from "@/components/circles/circles-root.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useAppNav } from "@/lib/hooks";

export default function Page() {
  const { circles } = useAppState();
  const nav = useAppNav();

  const root = circles.find((c) => c.parentId === null);

  return <CirclesRootPage circles={circles} onOpenCircle={(c) => nav.openCircle(c, root?.name)} />;
}
