"use client";

import { Suspense } from "react";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import { NeighborhoodDirectoryPage } from "@/components/directory/neighborhood-directory.page";
import { OrgPage } from "@/components/orgs/org.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useProfileModal } from "@/components/providers/profile-modal-provider";
import { useAppNav, useMemberById, useMembers } from "@/lib/hooks";
import { orgMembers } from "@/lib/orgs.util";

// every org lives at this one flat route, however deep it sits in the
// tree — a Neighborhood Council (org.neighborhood set) renders as the
// folder view (its "page" is browsing into that neighborhood), everything
// else renders as its own detail page. Keying by the org's own stable id
// rather than its position in the hierarchy means reparenting an org (see
// its Scope field on the manage page) never changes its URL.
function DirectoryOrg() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { orgs, events, profile } = useAppState();
  const { open } = useProfileModal();
  const nav = useAppNav();
  const members = useMembers();
  const memberById = useMemberById();

  const org = orgs.find((o) => o.id === id);
  if (!org) notFound();

  if (org.neighborhood) {
    return (
      <NeighborhoodDirectoryPage
        org={org}
        orgs={orgs}
        members={members}
        profile={profile}
        onOpenOrg={nav.openOrg}
        onOpenRoot={() => router.push("/directory")}
        onOpenMember={open}
        initialTypeFilter={searchParams.get("types")?.split(",")}
      />
    );
  }

  return (
    <OrgPage
      org={org}
      isMember={orgMembers(org, members).includes(profile.id)}
      lastEditor={org.lastEditedBy ? memberById(org.lastEditedBy) || null : null}
      lastEditedAt={org.lastEditedAt}
      events={events}
      onBack={() => router.back()}
      backLabel={searchParams.get("from") || undefined}
      onOpenMember={open}
      onOpenOrg={(o) => nav.openOrg(o, org.name)}
      onOpenEvent={(e) => nav.openEvent(e, org.name)}
      onManage={() => router.push(`/directory/${org.id}/manage`)}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DirectoryOrg />
    </Suspense>
  );
}
