"use client";

import { notFound, useParams } from "next/navigation";
import { TaskFormPage } from "@/components/circles/task-form.page";
import { useAppState } from "@/components/providers/app-state-provider";
import { useGoBack } from "@/components/providers/back-handler-provider";

// one task, to read or change: from the Tasks tab on a phone, Home's My tasks,
// or the notice telling someone it's theirs. Only its circle's members are
// sent it, so to anyone else it doesn't exist.
export default function Page() {
  const { id, taskId } = useParams<{ id: string; taskId: string }>();
  const { circles, tasks } = useAppState();
  const goBack = useGoBack();
  const task = tasks.find((t) => t.id === taskId && t.circleId === id);
  const circle = task && circles.find((c) => c.id === task.circleId);
  if (!task || !circle) notFound();
  // keyed by the task, so another task opened in its place starts afresh
  return <TaskFormPage key={task.id} circle={circle} task={task} onDone={goBack} />;
}
