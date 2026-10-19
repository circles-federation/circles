"use client";

import { notFound, useParams, useRouter } from "next/navigation";
import { NeighborhoodPostPage } from "@/components/circles/neighborhood-post.page";
import { ResourceFormPage } from "@/components/circles/resource-form.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useGoBack } from "@/components/providers/back-handler-provider";
import { useToast } from "@/components/shared";
import { isCircleMember, postingCirclesFor } from "@/lib/circles.util";

// a new bulletin item, as a page — where a phone adds one; desktop uses the
// dialog on the circle page. Only members have a bulletin, and the city has
// none, so anyone else gets a 404, as the server would refuse the item
// anyway. A neighborhood's is a post proposed by one of the Circles in it,
// so only a member of one of those reaches its form.
export default function Page() {
  const { id } = useParams<{ id: string }>();
  const { circles, profile } = useAppState();
  const goBack = useGoBack();
  const router = useRouter();
  const { showToast } = useToast();

  const circle = circles.find((c) => c.id === id);
  if (!circle || circle.parentId === null) notFound();
  if (circle.type === "neighborhood") {
    const posting = postingCirclesFor(profile.id, circle, circles);
    if (posting.length === 0) notFound();
    return (
      <NeighborhoodPostPage
        neighborhood={circle}
        circles={posting}
        // replace, not push: the form's done with, so Back shouldn't land on it
        onPosted={() => {
          showToast({ tone: "success", title: "Posted", message: `It's on ${circle.name}'s bulletin, and in everyone's next digest.` });
          router.replace(`/circles/${circle.id}`);
        }}
        onProposed={(proposalId) => {
          showToast({ tone: "success", title: "Proposal sent", message: "Your circle's members have been asked to consent." });
          router.replace(`/proposals/${proposalId}`);
        }}
        onDiscard={goBack}
      />
    );
  }
  if (!isCircleMember(circle, profile.id)) notFound();

  return <ResourceFormPage circleId={circle.id} resource={null} onDone={goBack} />;
}
