"use client";

import { notFound, useParams } from "next/navigation";
import { InvitePage } from "@/components/circles/invite.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { isCircleMember } from "@/lib/circles.util";

// inviting people to a circle, as a page — where a phone does it; desktop uses
// the dialog on the circle page. Only its members may, and a neighborhood or
// the city takes no invitations, so anyone or anywhere else is a 404.
export default function Page() {
  const { id } = useParams<{ id: string }>();
  const { circles, profile } = useAppState();
  const circle = circles.find((c) => c.id === id);
  if (!circle || circle.type === "neighborhood" || circle.parentId === null || !isCircleMember(circle, profile.id)) notFound();
  return <InvitePage circle={circle} />;
}
