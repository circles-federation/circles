"use client";

import { notFound } from "next/navigation";
import { CircleInboxSettingsPage } from "@/components/circles/circle-inbox-settings.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useGoBack } from "@/components/providers/back-handler-provider";
import { circleCanHaveInbox } from "@/lib/circles.util";
import { useManagedCircle, useProposeCircleChanges } from "@/lib/hooks";

export default function Page() {
  const { circles, profile } = useAppState();
  const goBack = useGoBack();
  const { circle, openProposal } = useManagedCircle()!;
  const propose = useProposeCircleChanges(circle);
  // only a Circle, a collective or a co-op can have one
  if (!circleCanHaveInbox(circle)) notFound();
  return (
    <CircleInboxSettingsPage
      circle={circle}
      circles={circles}
      memberId={profile.id}
      {...(openProposal ? { openProposal } : {})}
      onPropose={propose}
      onBack={goBack}
    />
  );
}
