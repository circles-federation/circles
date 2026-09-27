"use client";

import { notFound, useParams } from "next/navigation";
import { ResourceFormPage } from "@/components/circles/resource-form.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useGoBack } from "@/components/providers/back-handler-provider";
import { isCircleMember } from "@/lib/circles.util";

// a new bulletin item, as a page — where a phone adds one; desktop uses the
// dialog on the circle page. Only members have a bulletin, and a neighborhood
// (or the city) has none, so anyone else gets a 404, as the server would
// refuse the item anyway.
export default function Page() {
  const { id } = useParams<{ id: string }>();
  const { circles, profile } = useAppState();
  const goBack = useGoBack();

  const circle = circles.find((c) => c.id === id);
  if (!circle || circle.type === "neighborhood" || circle.parentId === null || !isCircleMember(circle, profile.id)) notFound();

  return <ResourceFormPage circleId={circle.id} resource={null} onDone={goBack} />;
}
