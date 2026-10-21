"use client";

import { useState } from "react";
import { CheckIcon } from "@heroicons/react/24/outline";
import { Button, ConfirmModal, PageContainer } from "@/components/shared";
import { useBackHandler } from "@/components/providers/back-handler-provider";
import { useTopBarAction } from "@/components/providers/top-bar-action-provider";
import type { Circle, CircleTask } from "@/lib/types";
import { DeleteTaskConfirm, TaskFields, useTaskForm } from "./task-form";

interface TaskFormPageProps {
  circle: Circle;
  task: CircleTask | null;
  // leave the page: after saving or deleting, or once changes are discarded
  onDone: () => void;
}

/* A task as a page: on a phone, and wherever one's opened from outside its
   circle's Tasks tab (Home's My tasks, a notification). Save is the top bar's
   action and leaving is its Back, so there's no Save or Cancel at the foot;
   Delete, when editing, still is. */
export function TaskFormPage({ circle, task, onDone }: TaskFormPageProps) {
  const form = useTaskForm(circle, task, onDone);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useBackHandler(form.dirty ? () => setConfirmingDiscard(true) : null);
  useTopBarAction({ label: form.busy ? "Saving" : "Save", icon: CheckIcon, onAction: () => void form.submit(), disabled: !form.dirty || form.busy, variant: "primary" });

  return (
    <PageContainer size="compact">
      <form onSubmit={form.submit} noValidate className="flex flex-col gap-5">
        <p className="font-serif text-sm text-soft">In {circle.name}</p>
        <TaskFields form={form} circle={circle} />
        {task && (
          <Button type="button" variant="danger" onClick={() => setDeleting(true)} disabled={form.busy} className="mt-4 w-full">
            Delete
          </Button>
        )}
      </form>

      {confirmingDiscard && (
        <ConfirmModal
          title="Discard changes?"
          message="You have unsaved changes to this task. If you leave now, they'll be lost."
          confirmLabel="Discard"
          cancelLabel="Cancel"
          onConfirm={onDone}
          onCancel={() => setConfirmingDiscard(false)}
        />
      )}
      {deleting && task && <DeleteTaskConfirm task={task} onCancel={() => setDeleting(false)} onDeleted={onDone} />}
    </PageContainer>
  );
}
