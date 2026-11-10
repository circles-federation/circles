"use client";

import { notFound } from "next/navigation";
import { CircleFeaturesPage } from "@/components/circles/circle-features.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useGoBack } from "@/components/providers/back-handler-provider";
import { isGroup } from "@/lib/circles.util";
import { useManagedCircle, useProposeCircleChanges } from "@/lib/hooks";

export default function Page() {
  const { circles, profile } = useAppState();
  const goBack = useGoBack();
  const { circle, openProposal } = useManagedCircle()!;
  const propose = useProposeCircleChanges(circle);
  // only a group has features to switch on; every other circle has them by its type
  if (!isGroup(circle)) notFound();
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
