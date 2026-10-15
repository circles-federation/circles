"use client";

import { notFound } from "next/navigation";
import { CircleRolesPage } from "@/components/circles/circle-roles.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useGoBack } from "@/components/providers/back-handler-provider";
import { circleHasRoles } from "@/lib/circle-roles.util";
import { useManagedCircle, useProposeCircleChanges } from "@/lib/hooks";

export default function Page() {
  const { circles, profile } = useAppState();
  const goBack = useGoBack();
  const { circle, openProposal } = useManagedCircle()!;
  const propose = useProposeCircleChanges(circle);
  // a neighborhood, a group and the city have no roles
  if (!circleHasRoles(circle)) notFound();
  return (
    <CircleRolesPage
      circle={circle}
      circles={circles}
      memberId={profile.id}
      {...(openProposal ? { openProposal } : {})}
      onPropose={propose}
      onBack={goBack}
    />
  );
}
