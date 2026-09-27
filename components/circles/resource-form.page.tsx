"use client";

import { useState } from "react";
import { CheckIcon } from "@heroicons/react/24/outline";
import { Button, ConfirmModal, PageContainer } from "@/components/shared";
import { useBackHandler } from "@/components/providers/back-handler-provider";
import { useTopBarAction } from "@/components/providers/top-bar-action-provider";
import type { CircleResource } from "@/lib/types";
import { RemoveResourceConfirm, ResourceFields, useResourceForm } from "./resource-form";

interface ResourceFormPageProps {
  circleId: string;
  resource: CircleResource | null;
  // leave the page: after saving or removing, or once changes are discarded
  onDone: () => void;
}

/* Adding or editing a bulletin item on a phone — the page ResourceFormModal
   becomes there. Save is the top bar's action and leaving is its Back, so
   there's no Save or Cancel at the foot; Remove, when editing, still is. */
export function ResourceFormPage({ circleId, resource, onDone }: ResourceFormPageProps) {
  const form = useResourceForm(circleId, resource, onDone);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [removing, setRemoving] = useState(false);

  useBackHandler(form.dirty ? () => setConfirmingDiscard(true) : null);
  useTopBarAction({ label: form.busy ? "Saving" : "Save", icon: CheckIcon, onAction: () => void form.submit(), disabled: !form.dirty || form.busy, variant: "primary" });

  return (
    <PageContainer size="compact">
      <form onSubmit={form.submit} noValidate className="flex flex-col gap-5">
        <ResourceFields form={form} />
        {resource && (
          <Button type="button" variant="danger" onClick={() => setRemoving(true)} disabled={form.busy} className="mt-4 w-full">
            Remove
          </Button>
        )}
      </form>

      {confirmingDiscard && (
        <ConfirmModal
          title="Discard changes?"
          message="You have unsaved changes to this item. If you leave now, they'll be lost."
          confirmLabel="Discard"
          cancelLabel="Cancel"
          onConfirm={onDone}
          onCancel={() => setConfirmingDiscard(false)}
        />
      )}
      {removing && resource && <RemoveResourceConfirm resource={resource} onCancel={() => setRemoving(false)} onRemoved={onDone} />}
    </PageContainer>
  );
}
