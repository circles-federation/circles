"use client";

import { useState, type FormEvent } from "react";
import { Button, ConfirmModal, Input, Label, Modal, TextArea } from "@/components/shared";
import { useAppState } from "@/components/providers/app-state-provider";
import { RESOURCE_MESSAGE_MAX, RESOURCE_TITLE_MAX, isAnnouncement, validateResourceInput, type ResourceErrors, type ResourceInput } from "@/lib/resources.util";
import type { CircleResource, ResourceIcon } from "@/lib/types";
import { ResourceKindPicker } from "./resource-kind-picker";
import { resourceFormTitle, resourceOption } from "./resource-kinds";

/* Adding or editing one bulletin item, in either of two shells: a dialog on
   desktop (ResourceFormModal, below) and a page of its own on a phone
   (ResourceFormPage). Both hold the same state through useResourceForm and
   render the same ResourceFields. What it is comes first, since that decides
   what else to fill in: a link for a folder, file or video, a message for an
   announcement. Both are kept while the form is open, so switching kind
   doesn't lose what was typed; only the one the kind uses is saved. */
// `save` in place of adding to the circle's bulletin: a neighborhood post,
// which is proposed rather than saved (NeighborhoodPostPage)
export function useResourceForm(circleId: string, resource: CircleResource | null, onSaved: () => void, save?: (input: ResourceInput) => Promise<{ ok: true } | { ok: false; error: string }>) {
  const { addResource, updateResource } = useAppState();
  const [icon, setIcon] = useState<ResourceIcon>(resource?.icon ?? "folder");
  const [title, setTitle] = useState(resource?.title ?? "");
  const [url, setUrl] = useState(resource?.url ?? "");
  const [message, setMessage] = useState(resource?.message ?? "");
  const [errors, setErrors] = useState<ResourceErrors>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);

  // only what the chosen kind saves counts as a change
  const dirty =
    icon !== (resource?.icon ?? "folder") ||
    title !== (resource?.title ?? "") ||
    (isAnnouncement(icon) ? message !== (resource?.message ?? "") : url !== (resource?.url ?? ""));

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    const input = { title, icon, url, message };
    // instant feedback only — the server re-validates and is the real check
    const found = validateResourceInput(input);
    setErrors(found);
    setServerError("");
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    const result = save ? await save(input) : resource ? await updateResource(resource.id, input) : await addResource(circleId, input);
    setBusy(false);
    if (result.ok) onSaved();
    else setServerError(result.error);
  }

  return { icon, setIcon, title, setTitle, url, setUrl, message, setMessage, errors, serverError, busy, dirty, submit };
}

export type ResourceFormState = ReturnType<typeof useResourceForm>;

// `audience`: who reads it, for the message's prompt ("members", "neighbors")
export function ResourceFields({ form, audience = "members" }: { form: ResourceFormState; audience?: string }) {
  const { icon, setIcon, title, setTitle, url, setUrl, message, setMessage, errors, serverError } = form;
  return (
    <>
      <div>
        <Label htmlFor="resource-kind">What are you adding?</Label>
        <ResourceKindPicker id="resource-kind" value={icon} onChange={setIcon} audience={audience} />
        {errors.icon && <p className="mt-1.5 font-sans text-xs font-bold text-danger">{errors.icon}</p>}
      </div>

      <div>
        <Label htmlFor="resource-title">Title</Label>
        <Input id="resource-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={RESOURCE_TITLE_MAX} placeholder={resourceOption(icon).titlePlaceholder} />
        {errors.title && <p className="mt-1.5 font-sans text-xs font-bold text-danger">{errors.title}</p>}
      </div>

      {isAnnouncement(icon) ? (
        <div>
          <Label htmlFor="resource-message">Message</Label>
          <TextArea id="resource-message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={RESOURCE_MESSAGE_MAX} rows={5} placeholder={`What do ${audience} need to know?`} />
          {errors.message && <p className="mt-1.5 font-sans text-xs font-bold text-danger">{errors.message}</p>}
        </div>
      ) : (
        <div>
          <Label htmlFor="resource-url">Link</Label>
          <Input id="resource-url" value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" placeholder="https://" />
          {errors.url && <p className="mt-1.5 font-sans text-xs font-bold text-danger">{errors.url}</p>}
        </div>
      )}

      {serverError && <p className="font-sans text-sm font-bold text-danger">{serverError}</p>}
    </>
  );
}

// removing lives in the form, not on the card, which keeps the board
// uncluttered — and it asks first either way
export function RemoveResourceConfirm({ resource, onCancel, onRemoved }: { resource: CircleResource; onCancel: () => void; onRemoved: () => void }) {
  const { removeResource } = useAppState();
  return (
    <ConfirmModal
      title={`Remove this ${resourceOption(resource.icon).label.toLowerCase()}?`}
      message={`“${resource.title}” will be removed for everyone in this circle.${isAnnouncement(resource.icon) ? "" : " The link itself isn't affected."}`}
      confirmLabel="Remove"
      cancelLabel="Keep it"
      onCancel={onCancel}
      onConfirm={() => {
        onRemoved();
        void removeResource(resource.id);
      }}
    />
  );
}

interface ResourceFormModalProps {
  circleId: string;
  resource: CircleResource | null;
  onClose: () => void;
  onRemove: (resource: CircleResource) => void;
}

// the desktop shell: a dialog, with Save, Cancel and (editing) Remove at its foot
export function ResourceFormModal({ circleId, resource, onClose, onRemove }: ResourceFormModalProps) {
  const form = useResourceForm(circleId, resource, onClose);
  return (
    <Modal onClose={onClose} className="max-w-110" title={resourceFormTitle(resource?.icon)}>
      <form onSubmit={form.submit} noValidate className="flex flex-col gap-5 px-5 py-5">
        <ResourceFields form={form} />
        <div className="flex gap-3">
          <Button type="submit" disabled={form.busy}>{form.busy ? "Saving…" : "Save"}</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          {resource && (
            <Button type="button" variant="danger" onClick={() => onRemove(resource)} disabled={form.busy} className="ml-auto">
              Remove
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
