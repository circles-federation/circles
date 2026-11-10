"use client";

import { notFound } from "next/navigation";
import { CircleFeaturesPage } from "@/components/circles/circle-features.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useGoBack } from "@/components/providers/back-handler-provider";
import { circleHasPage } from "@/lib/circles.util";
import { useManagedCircle, useProposeCircleChanges } from "@/lib/hooks";

export default function Page() {
  const { circles, profile } = useAppState();
  const goBack = useGoBack();
  const { circle, openProposal } = useManagedCircle()!;
  const propose = useProposeCircleChanges(circle);
  // a neighborhood and the city have none to switch
  if (!circleHasPage(circle)) notFound();
  return (
    <CircleFeaturesPage
      circle={circle}
      circles={circles}
      memberId={profile.id}
      {...(openProposal ? { openProposal } : {})}
      onPropose={propose}
      onBack={goBack}
    />
  );
}
