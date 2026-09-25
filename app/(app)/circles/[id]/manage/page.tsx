"use client";

import { notFound, useParams } from "next/navigation";
import { ManageCirclePage } from "@/components/circles/manage-circle.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useGoBack } from "@/components/providers/back-handler-provider";
import { isCircleMember } from "@/lib/circles.util";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  // after saving or cancelling: back where they came from, or up to the
  // circle's own page if they opened this directly (never out of the app)
  const goBack = useGoBack();
  const { circles, profile, saveCircle, saveCircleRoles } = useAppState();

  // only a member can manage a circle's page (the server enforces this too —
  // see updateCircle in lib/db/circles.ts); CirclePage only shows the Manage
  // button under the same condition, but the route itself is reachable
  // directly, so it needs the same gate a non-member would otherwise sail past
  const circle = circles.find((c) => c.id === id);
  if (!circle || !isCircleMember(circle, profile.id)) notFound();

  return (
    <ManageCirclePage
      circle={circle}
      circles={circles}
      onSave={(patch) => saveCircle(circle.id, patch)}
      onSaveRoles={(roles) => saveCircleRoles(circle.id, roles)}
      onBack={goBack}
    />
  );
}
