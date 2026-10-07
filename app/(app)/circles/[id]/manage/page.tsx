"use client";

import { useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import { ManageCirclePage } from "@/components/circles/manage-circle.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useGoBack } from "@/components/providers/back-handler-provider";
import { useToast } from "@/components/shared";
import { isCircleMember } from "@/lib/circles.util";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  // after saving or cancelling: back where they came from, or up to the
  // circle's own page if they opened this directly (never out of the app)
  const goBack = useGoBack();
  const { circles, proposals, profile, saveCircle, proposeCircleChanges, leaveCircle } = useAppState();

  // only a member can manage a circle's page (the server enforces this too —
  // see updateCircle in lib/db/circles.ts); CirclePage only shows the Manage
  // button under the same condition, but the route itself is reachable
  // directly, so it needs the same gate a non-member would otherwise sail past
  // set while leaving: they stop being a member before this page has gone,
  // and that moment shouldn't read as a 404
  const [leaving, setLeaving] = useState(false);
  const circle = circles.find((c) => c.id === id);
  if (!circle || !isCircleMember(circle, profile.id)) {
    if (leaving) return null;
    notFound();
  }

  return (
    <ManageCirclePage
      circle={circle}
      circles={circles}
      openProposal={proposals.find((p) => p.circleId === circle.id && p.status === "open")}
      onSave={(patch) => saveCircle(circle.id, patch)}
      onPropose={async (changes) => {
        const result = await proposeCircleChanges(circle.id, changes);
        if (!result.ok) return result;
        // a circle of one decides it at once; otherwise the proposal's page,
        // where the proposer can watch the answers come in
        if (result.passed) {
          showToast({ tone: "success", title: "Changes saved", message: "You're its only member, so they were made at once." });
          goBack();
        } else {
          showToast({ tone: "success", title: "Proposal sent", message: `${circle.name}'s members have been asked to consent.` });
          router.replace(`/proposals/${result.proposal.id}`);
        }
        return { ok: true };
      }}
      onBack={goBack}
      // replace, not push: this page is gone for them once they've left. Back
      // to the circle's page, now as a non-member, or to the Circles browser
      // if they were its last member and it's archived
      onLeave={async () => {
        setLeaving(true);
        const result = await leaveCircle(circle.id);
        if (!result.ok) {
          setLeaving(false);
          return result;
        }
        router.replace(result.archived ? "/circles" : `/circles/${circle.id}`);
        return { ok: true };
      }}
    />
  );
}
