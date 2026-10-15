"use client";

import { CircleDetailsPage } from "@/components/circles/circle-details.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useGoBack } from "@/components/providers/back-handler-provider";
import { useManagedCircle, useProposeCircleChanges } from "@/lib/hooks";

export default function Page() {
  const { circles, profile } = useAppState();
  const goBack = useGoBack();
  const { circle, openProposal } = useManagedCircle()!;
  const propose = useProposeCircleChanges(circle);
  return (
    <CircleDetailsPage
      circle={circle}
      circles={circles}
      memberId={profile.id}
      {...(openProposal ? { openProposal } : {})}
      onPropose={propose}
      onBack={goBack}
    />
  );
}
