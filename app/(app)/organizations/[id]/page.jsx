"use client";

import { Suspense } from "react";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import { OrgPage } from "@/components/orgs/org.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useProfileModal } from "@/components/providers/profile-modal-provider";
import { memberById } from "@/lib/data";
import { useAppNav } from "@/lib/hooks";

function OrgDetail() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { orgs, events, profile } = useAppState();
  const { open } = useProfileModal();
  const nav = useAppNav();

  const org = orgs.find((o) => o.id === id);
  if (!org) notFound();

  return (
    <OrgPage
      org={org}
      isMember={org.members.includes(profile.id)}
      lastEditor={org.lastEditedBy ? memberById(org.lastEditedBy) : null}
      lastEditedAt={org.lastEditedAt}
      events={events}
      onBack={() => router.back()}
      backLabel={searchParams.get("from")}
      onOpenMember={open}
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
