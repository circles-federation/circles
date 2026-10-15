"use client";

import { notFound } from "next/navigation";
import { CircleWikiPage } from "@/components/circles/circle-wiki.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useGoBack } from "@/components/providers/back-handler-provider";
import { circleHasWiki } from "@/lib/circles.util";
import { useManagedCircle } from "@/lib/hooks";

export default function Page() {
  const { saveCircle } = useAppState();
  const goBack = useGoBack();
  const { circle } = useManagedCircle()!;
  // a group has no wiki
  if (!circleHasWiki(circle)) notFound();
  return <CircleWikiPage circle={circle} onSave={(patch) => saveCircle(circle.id, patch)} onBack={goBack} />;
}
