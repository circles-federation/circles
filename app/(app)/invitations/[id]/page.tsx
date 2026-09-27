"use client";

import { useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import { InvitationPage } from "@/components/circles/invitation.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useGoBack } from "@/components/providers/back-handler-provider";
import { useAppNav } from "@/lib/hooks";

// an invitation to a circle — only ever in AppState for the person invited and
// the circle's members, so anyone else gets a 404
export default function Page() {
  const { id } = useParams<{ id: string }>();
  const { invitations, circles } = useAppState();
  const nav = useAppNav();
  const router = useRouter();
  const goBack = useGoBack();

  // kept once shown: accepting or deleting it takes it out of AppState a
  // moment before the page is left, which would otherwise flash a 404
  const found = invitations.find((i) => i.id === id);
  const [shown, setShown] = useState(found);
  if (found && found !== shown) setShown(found);
  const invitation = found ?? shown;
  const circle = invitation && circles.find((c) => c.id === invitation.circleId);
  if (!invitation || !circle) notFound();

  return (
    <InvitationPage
      invitation={invitation}
      circle={circle}
      onOpenCircle={(c) => nav.openCircle(c)}
      onOpenMember={nav.openMember}
      // replace, not push: the invitation is gone, so Back shouldn't return to it
      onAccepted={(circleId) => router.replace(`/circles/${circleId}`)}
      onGone={goBack}
    />
  );
}
