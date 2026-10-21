"use client";

import { notFound, useParams } from "next/navigation";
import { TaskFormPage } from "@/components/circles/task-form.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useGoBack } from "@/components/providers/back-handler-provider";
import { circleHasTasks, isCircleMember } from "@/lib/circles.util";

// a new task, as a page: where a phone adds one (desktop uses the dialog on the
// circle's Tasks tab). Only a circle with a page that isn't a group has tasks
// (circleHasTasks), and only its members see them, so anyone else gets a 404, as the server would refuse it.
export default function Page() {
  const { id } = useParams<{ id: string }>();
  const { circles, profile } = useAppState();
  const goBack = useGoBack();
  const circle = circles.find((c) => c.id === id);
  if (!circle || !circleHasTasks(circle) || !isCircleMember(circle, profile.id)) notFound();
  return <TaskFormPage circle={circle} task={null} onDone={goBack} />;
}
