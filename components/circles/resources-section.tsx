"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowTopRightOnSquareIcon, DocumentIcon, FolderIcon, MegaphoneIcon, PencilIcon, PlusIcon, VideoCameraIcon, XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Button, ConfirmModal, Eyebrow, Input, Label, Modal, TextArea } from "@/components/shared";
import { useAppState } from "@/components/providers/app-state-provider";
import { RESOURCE_MESSAGE_MAX, RESOURCE_TITLE_MAX, isAnnouncement, resourceHost, validateResourceInput, type ResourceErrors } from "@/lib/resources.util";
import type { CircleResource, ResourceIcon } from "@/lib/types";

const ICONS = { folder: FolderIcon, file: DocumentIcon, video: VideoCameraIcon, announcement: MegaphoneIcon };

// each type gets its own color so what a resource is reads at a glance —
// folders yellow, files blue, videos purple, announcements red. Full literal
// class strings (not interpolated) so Tailwind's static scan sees them.
const ICON_TILE = {
  folder: "border-folder bg-folder/10 text-folder",
  file: "border-file bg-file/10 text-file",
  video: "border-video bg-video/10 text-video",
  announcement: "border-announcement bg-announcement/10 text-announcement",
};
const ICON_TEXT = { folder: "text-folder", file: "text-file", video: "text-video", announcement: "text-announcement" };

const ICON_OPTIONS: { key: ResourceIcon; label: string; hint: string; titlePlaceholder: string }[] = [
  { key: "folder", label: "Folder", hint: "A collection, like a shared drive", titlePlaceholder: "e.g. Shared drive" },
  { key: "file", label: "File", hint: "A single document", titlePlaceholder: "e.g. Meeting notes" },
  { key: "video", label: "Video", hint: "A recording or a livestream", titlePlaceholder: "e.g. Last month's meeting" },
  { key: "announcement", label: "Announcement", hint: "A message for members", titlePlaceholder: "e.g. Garden workday moved to Sunday" },
];

const optionFor = (icon: ResourceIcon) => ICON_OPTIONS.find((o) => o.key === icon) ?? ICON_OPTIONS[0]!;

/* A circle's members-only resources: links (a folder, a file, a video) and
   announcements, messages typed out for the circle. The caller (CirclePage)
   only renders this for a member; the data itself is members-only too —
   AppState's `resources` only ever holds the viewer's own circles' (see
   lib/db/resources.ts), so this never has to filter anyone out. Adding,
   editing, and removing save immediately, each as its own change rather than
   part of the Manage form. */
export function ResourcesSection({ circleId }: { circleId: string }) {
  const { resources, removeResource } = useAppState();
  const mine = resources.filter((r) => r.circleId === circleId);
  const [editing, setEditing] = useState<CircleResource | "new" | null>(null);
  const [removing, setRemoving] = useState<CircleResource | null>(null);

  return (
    <div>
      <Eyebrow className="text-soft">Resources</Eyebrow>

      <div className="mt-3.5 border-t border-ink">
        {mine.length === 0 && (
          <p className="pt-4 font-serif text-base text-soft">Nothing here yet — add an announcement, or a link your circle uses, like a shared drive.</p>
        )}
        {mine.map((r) => {
          const Icon = ICONS[r.icon];
          const tile = (
            <span className={clsx("flex size-11 shrink-0 items-center justify-center border", ICON_TILE[r.icon])}>
              <Icon className="size-5" strokeWidth={2} aria-label={optionFor(r.icon).label} />
            </span>
          );
          return (
            <div key={r.id} className={clsx("flex gap-2 border-b border-faint py-3 last:border-b-ink", isAnnouncement(r.icon) ? "items-start" : "items-center")}>
              {isAnnouncement(r.icon) ? (
                // an announcement is read here, not opened: the message itself, line breaks kept
                <div className="flex min-w-0 flex-1 items-start gap-3.5">
                  {tile}
                  <div className="min-w-0 pt-0.5">
                    <div className="font-sans text-sm font-bold">{r.title}</div>
                    <p className="mt-1 font-serif text-sm leading-normal whitespace-pre-line text-[#222]">{r.message}</p>
                  </div>
                </div>
              ) : (
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-3.5">
                  {tile}
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-sans text-sm font-bold">
                      <span className="truncate">{r.title}</span>
                      <ArrowTopRightOnSquareIcon className="size-3.5 shrink-0" strokeWidth={2.5} />
                    </span>
                    <span className="block truncate font-serif text-sm text-soft">{resourceHost(r.url ?? "")}</span>
                  </span>
                </a>
              )}
              <button
                onClick={() => setEditing(r)}
                title="Edit"
                aria-label={`Edit ${r.title}`}
                className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-soft hover:text-ink"
              >
                <PencilIcon className="size-4" strokeWidth={2} />
              </button>
              <button
                onClick={() => setRemoving(r)}
                title="Remove"
                aria-label={`Remove ${r.title}`}
                className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-soft hover:text-ink"
              >
                <XMarkIcon className="size-4" strokeWidth={2} />
              </button>
            </div>
          );
        })}
      </div>

      <Button variant="secondary" size="compact" onClick={() => setEditing("new")} className="mt-3">
        <PlusIcon className="size-3.5" strokeWidth={2.5} />
        Add resource
      </Button>

      {editing && (
        <ResourceForm circleId={circleId} resource={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}

      {removing && (
        <ConfirmModal
          title={`Remove this ${isAnnouncement(removing.icon) ? "announcement" : "resource"}?`}
          message={`“${removing.title}” will be removed for everyone in this circle.${isAnnouncement(removing.icon) ? "" : " The link itself isn't affected."}`}
          confirmLabel="Remove"
          cancelLabel="Keep it"
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const target = removing;
            setRemoving(null);
            void removeResource(target.id);
          }}
        />
      )}
    </div>
  );
}

interface ResourceFormProps {
  circleId: string;
  resource: CircleResource | null;
  onClose: () => void;
}

/* Adding or editing one resource. What it is comes first, since that decides
   what else to fill in: a link for a folder, file or video, a message for an
   announcement. Both are kept while the form is open, so switching kind
   doesn't lose what was typed; only the one the kind uses is saved. */
function ResourceForm({ circleId, resource, onClose }: ResourceFormProps) {
  const { addResource, updateResource } = useAppState();
  const [icon, setIcon] = useState<ResourceIcon>(resource?.icon ?? "folder");
  const [title, setTitle] = useState(resource?.title ?? "");
  const [url, setUrl] = useState(resource?.url ?? "");
  const [message, setMessage] = useState(resource?.message ?? "");
  const [errors, setErrors] = useState<ResourceErrors>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const announcement = isAnnouncement(icon);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const input = { title, icon, url, message };
    // instant feedback only — the server re-validates and is the real check
    const found = validateResourceInput(input);
    setErrors(found);
    setServerError("");
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    const result = resource ? await updateResource(resource.id, input) : await addResource(circleId, input);
    setBusy(false);
    if (result.ok) onClose();
    else setServerError(result.error);
  }

  return (
    <Modal onClose={onClose} className="max-w-110">
      <div className="flex items-center justify-between border-b border-ink px-4.5 py-3">
        <Eyebrow className="text-soft">{resource ? `Edit ${optionFor(resource.icon).label.toLowerCase()}` : "Add to the bulletin"}</Eyebrow>
        <button onClick={onClose} aria-label="Close" className="ml-3 shrink-0 cursor-pointer bg-transparent p-0">
          <XMarkIcon className="size-5 text-ink" strokeWidth={2} />
        </button>
      </div>
      <form onSubmit={submit} noValidate className="flex flex-col gap-5 px-4.5 py-5">
        <div>
          <Label>What are you adding?</Label>
          <div className="grid grid-cols-2 gap-3">
            {ICON_OPTIONS.map((o) => {
              const Icon = ICONS[o.key];
              const selected = icon === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setIcon(o.key)}
                  className={clsx(
                    "flex cursor-pointer flex-col items-start gap-1.5 border border-ink p-3 text-left",
                    selected ? "bg-ink text-paper" : "bg-paper text-ink",
                  )}
                >
                  <Icon className={clsx("size-5", !selected && ICON_TEXT[o.key])} strokeWidth={2} />
                  <span className="font-sans text-sm font-bold">{o.label}</span>
                  <span className={clsx("font-serif text-xs leading-snug", selected ? "text-paper/80" : "text-soft")}>{o.hint}</span>
                </button>
              );
            })}
          </div>
          {errors.icon && <p className="mt-1.5 font-sans text-xs font-bold text-danger">{errors.icon}</p>}
        </div>

        <div>
          <Label htmlFor="resource-title">Title</Label>
          <Input id="resource-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={RESOURCE_TITLE_MAX} placeholder={optionFor(icon).titlePlaceholder} />
          {errors.title && <p className="mt-1.5 font-sans text-xs font-bold text-danger">{errors.title}</p>}
        </div>

        {announcement ? (
          <div>
            <Label htmlFor="resource-message">Message</Label>
            <TextArea id="resource-message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={RESOURCE_MESSAGE_MAX} rows={5} placeholder="What do members need to know?" />
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

        <div className="flex gap-3">
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}
