"use client";

import { notFound, useRouter } from "next/navigation";
import { NewFederationPage } from "@/components/circles/new-federation.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useGoBack } from "@/components/providers/back-handler-provider";
import { useToast } from "@/components/shared";
import { indexCircles } from "@/lib/circles.util";
import { federationRefusal } from "@/lib/federation.util";
import { useManagedCircle } from "@/lib/hooks";

export default function Page() {
  const { circles, proposeFederation } = useAppState();
  const router = useRouter();
  const goBack = useGoBack();
  const { showToast } = useToast();
  const { circle } = useManagedCircle()!;
  if (federationRefusal(circle, indexCircles(circles))) notFound();

  return (
    <NewFederationPage
      circle={circle}
      circles={circles}
      onPropose={async (input) => {
        const result = await proposeFederation(input);
        if (!result.ok) return result;
        // replace, not push: the form is done with. With no one else to ask
        // it's formed already
        const { status, subjectCircleId, id } = result.proposal;
        if (status === "passed" && subjectCircleId) {
          showToast({ tone: "success", title: "Federation formed", message: "There was no one else to ask." });
          router.replace(`/circles/${subjectCircleId}`);
        } else {
          showToast({ tone: "success", title: "Proposal sent", message: `${circle.name} consents first, then the others.` });
          router.replace(`/proposals/${id}`);
        }
        return { ok: true };
      }}
      onBack={goBack}
    />
  );
}
