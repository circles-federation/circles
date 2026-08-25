"use client";

import { BrowsePage } from "@/components/directory/browse.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useProfileModal } from "@/components/providers/profile-modal-provider";
import { MEMBERS } from "@/lib/data";
import { useAppNav } from "@/lib/hooks";

export default function Page() {
  const { orgs, profile } = useAppState();
  const { open } = useProfileModal();
  const nav = useAppNav();

  return (
    <BrowsePage
      org={null}
      orgs={orgs}
      members={MEMBERS}
      profile={profile}
      onOpenOrg={nav.openOrg}
      onOpenMember={open}
    />
  );
}
