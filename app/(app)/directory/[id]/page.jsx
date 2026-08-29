"use client";

import { useEffect } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import { NeighborhoodDirectoryPage } from "@/components/directory/neighborhood-directory.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useProfileModal } from "@/components/providers/profile-modal-provider";
import { MEMBERS } from "@/lib/data";
import { useAppNav } from "@/lib/hooks";

export default function Page() {
  const { id } = useParams();
  const router = useRouter();
  const { orgs, profile } = useAppState();
  const { open } = useProfileModal();
  const nav = useAppNav();

  const org = orgs.find((o) => o.id === id);
  const isCouncil = !!org?.neighborhood;

  // only Neighborhood Councils browse here — every other org has its own
  // page at /organizations (see lib/hooks.js's openOrg), so a stray link
  // to a non-council id lands here safely instead of erroring
  useEffect(() => {
    if (org && !isCouncil) router.replace(`/organizations/${id}`);
  }, [org, isCouncil, id, router]);

  if (!org) notFound();
  if (!isCouncil) return null;

  return (
    <NeighborhoodDirectoryPage
      org={org}
      orgs={orgs}
      members={MEMBERS}
      profile={profile}
      onOpenOrg={nav.openOrg}
      onOpenRoot={() => router.push("/directory")}
      onOpenMember={open}
    />
  );
}
