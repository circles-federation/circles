"use client";

import { Suspense, useEffect } from "react";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import { OrgPage } from "@/components/orgs/org.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useProfileModal } from "@/components/providers/profile-modal-provider";
import { memberById, MEMBERS } from "@/lib/data";
import { useAppNav } from "@/lib/hooks";
import { orgMembers } from "@/lib/orgs.util";

function OrgDetail() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { orgs, events, profile } = useAppState();
  const { open } = useProfileModal();
  const nav = useAppNav();

  const org = orgs.find((o) => o.id === id);

  // Neighborhood Councils browse at /directory instead of having their own
  // page here (see lib/hooks.js's openOrg) — bounce a stray link forward
  useEffect(() => {
    if (org?.neighborhood) router.replace(`/directory/${id}`);
  }, [org, id, router]);

  if (!org) notFound();
  if (org.neighborhood) return null;

  return (
    <OrgPage
      org={org}
      isMember={orgMembers(org, MEMBERS).includes(profile.id)}
      lastEditor={org.lastEditedBy ? memberById(org.lastEditedBy) : null}
      lastEditedAt={org.lastEditedAt}
      events={events}
      onBack={() => router.back()}
      backLabel={searchParams.get("from")}
      onOpenMember={open}
      onOpenOrg={(o) => nav.openOrg(o, org.name)}
      onOpenEvent={(e) => nav.openEvent(e, org.name)}
      onManage={() => router.push(`/organizations/${org.id}/manage`)}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <OrgDetail />
    </Suspense>
  );
}
