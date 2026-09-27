"use client";

import { notFound, useParams } from "next/navigation";
import { ResourceFormPage } from "@/components/circles/resource-form.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useGoBack } from "@/components/providers/back-handler-provider";

// editing a bulletin item, as a page — where a phone edits one; desktop uses
// the dialog. AppState only ever holds the viewer's own circles' items, so
// one that isn't there is a 404.
export default function Page() {
  const { id, resourceId } = useParams<{ id: string; resourceId: string }>();
  const { resources } = useAppState();
  const goBack = useGoBack();

  const resource = resources.find((r) => r.id === resourceId && r.circleId === id);
  if (!resource) notFound();

  return <ResourceFormPage circleId={id} resource={resource} onDone={goBack} />;
}
