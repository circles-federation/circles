"use client";

import { notFound, useParams } from "next/navigation";
import { InviteNeighborsPage } from "@/components/circles/invite-neighbors.page";
import { useAppState } from "@/components/providers/app-state-provider";

// a neighborhood's poster, for inviting the people who live there: only from
// your own neighborhood, so anywhere else is a 404
export default function Page() {
  const { id } = useParams<{ id: string }>();
  const { circles, profile } = useAppState();
  const neighborhood = circles.find((c) => c.id === id);
  if (!neighborhood || neighborhood.type !== "neighborhood" || neighborhood.id !== profile.homeCircleId) notFound();
  const city = circles.find((c) => c.parentId === null)?.name ?? "";
  return <InviteNeighborsPage neighborhood={neighborhood} city={city} />;
}
