"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ManageCirclePage } from "@/components/circles/manage-circle.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useManagedCircle } from "@/lib/hooks";

export default function Page() {
  const router = useRouter();
  const { profile, leaveCircle } = useAppState();
  // set while leaving: they stop being a member before this page has gone,
  // and that moment shouldn't read as a 404
  const [leaving, setLeaving] = useState(false);
  const managed = useManagedCircle({ allowGone: leaving });
  if (!managed) return null;
  const { circle, openProposal } = managed;

  return (
    <ManageCirclePage
      circle={circle}
      memberId={profile.id}
      {...(openProposal ? { openProposal } : {})}
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
