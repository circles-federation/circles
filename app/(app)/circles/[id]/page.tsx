"use client";

import { Suspense } from "react";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import { CirclePage } from "@/components/circles/circle.page";
import { NeighborhoodPage } from "@/components/circles/neighborhood.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useProfileModal } from "@/components/providers/profile-modal-provider";
import { isCircleMember } from "@/lib/circles.util";
import { useAppNav, useMemberById, useMembers } from "@/lib/hooks";

// every circle lives at this one flat route, however deep it sits in the
// tree — a neighborhood renders as the folder view (its "page" is browsing
// into that neighborhood), everything else renders as its own detail page.
// Keying by the circle's own stable id rather than its position in the
// hierarchy means reparenting a circle (see its Parent field on the manage
// page) never changes its URL.
function CircleRoute() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { circles, events, profile } = useAppState();
  const { open } = useProfileModal();
  const nav = useAppNav();
  const members = useMembers();
  const memberById = useMemberById();

  const circle = circles.find((c) => c.id === id);
  if (!circle) notFound();

  if (circle.type === "neighborhood") {
    return (
      <NeighborhoodPage
        circle={circle}
        circles={circles}
        members={members}
        profile={profile}
        onOpenCircle={(c) => nav.openCircle(c, circle.name)}
        onBack={() => router.back()}
        backLabel={searchParams.get("from") || undefined}
        onOpenMember={open}
        initialTypeFilter={searchParams.get("types")?.split(",")}
      />
    );
  }

  return (
    <CirclePage
      circle={circle}
      isMember={isCircleMember(circle, profile.id)}
      lastEditor={circle.lastEditedBy ? memberById(circle.lastEditedBy) || null : null}
      lastEditedAt={circle.lastEditedAt}
      events={events}
      onBack={() => router.back()}
      backLabel={searchParams.get("from") || undefined}
      onOpenMember={open}
      onOpenCircle={(c) => nav.openCircle(c, circle.name)}
      onOpenEvent={(e) => nav.openEvent(e, circle.name)}
      onManage={() => router.push(`/circles/${circle.id}/manage`)}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CircleRoute />
    </Suspense>
  );
}
