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
   part of the Manage form. Its + sits in the circle page's tab row, so that
   page owns whether the add dialog is open (`adding`). */
export function BulletinSection({ circleId, adding, onAdd, onAddingDone }: { circleId: string; adding: boolean; onAdd: () => void; onAddingDone: () => void }) {
  const { resources, removeResource } = useAppState();
  const mine = resources.filter((r) => r.circleId === circleId);
  const [editing, setEditing] = useState<CircleResource | null>(null);
  const [removing, setRemoving] = useState<CircleResource | null>(null);

  return (
    <div>
      {mine.length === 0 ? (
        // an empty board is where adding the first item is offered, as a blank
        // card to fill in; once something's pinned, the tab row's + is enough
        <button
          type="button"
          onClick={onAdd}
          className="ink-press flex w-full cursor-pointer flex-col items-center gap-1.5 border border-dashed border-soft bg-transparent px-6 py-7 text-center text-soft"
        >
          <PlusIcon className="size-6" strokeWidth={2} aria-hidden />
          <Eyebrow className="text-soft">Add item</Eyebrow>
          <span className="mt-1 font-serif text-base">Post an announcement, or pin a link your circle uses, like a shared drive.</span>
        </button>
      ) : (
        // a board of pinned cards, as many columns as fit; dense, so a wide
        // announcement doesn't leave holes behind it
        <div className="grid grid-flow-row-dense grid-cols-[repeat(auto-fill,minmax(min(100%,10rem),1fr))] gap-3.5">
          {mine.map((r) => (
            <BulletinCard key={r.id} resource={r} onEdit={() => setEditing(r)} />
          ))}
        </div>
      )}

      {(adding || editing) && (
        <ResourceForm
          circleId={circleId}
          resource={editing}
          onClose={() => {
            setEditing(null);
            onAddingDone();
          }}
          onRemove={(r) => {
            setEditing(null);
            setRemoving(r);
          }}
        />
      )}

      {removing && (
        <ConfirmModal
          title={`Remove this ${optionFor(removing.icon).label.toLowerCase()}?`}
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

// the colored rule along a card's top, in its kind's color
const TYPE_RULE = { folder: "border-t-folder", file: "border-t-file", video: "border-t-video", announcement: "border-t-announcement" };

/* One card pinned to the bulletin: its kind (icon and name, in that kind's
   color, which also rules the card's top edge), its title, and then either
   where a link goes or an announcement's whole message. A link card is a
   link all over — its title's link is stretched across it — and inverts
   while pressed; an announcement is read where it is, and spans more of the
   board. Its edit button (where removing it lives too) sits above the
   stretched link, and doesn't press it. */
function BulletinCard({ resource: r, onEdit }: { resource: CircleResource; onEdit: () => void }) {
  const Icon = ICONS[r.icon];
  const announcement = isAnnouncement(r.icon);
  const control = "relative z-10 -my-1 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-soft hover:text-ink";
  return (
    <div
      className={clsx(
        "relative flex flex-col border border-t-[3px] border-ink bg-paper p-3.5",
        TYPE_RULE[r.icon],
        announcement ? "col-span-full min-[720px]:col-span-2" : "ink-press",
      )}
    >
      <div className="flex items-center gap-1.5">
        <Icon className={clsx("size-4 shrink-0", ICON_TEXT[r.icon])} strokeWidth={2} aria-hidden />
        <Eyebrow className={clsx("min-w-0 flex-1 truncate", ICON_TEXT[r.icon])}>{optionFor(r.icon).label}</Eyebrow>
        <button type="button" data-press-ignore onClick={onEdit} title="Edit" aria-label={`Edit ${r.title}`} className={clsx(control, "-mr-1.5")}>
          <PencilIcon className="size-4" strokeWidth={2} />
        </button>
      </div>
      <div className="mt-2.5 font-sans text-base leading-tight font-bold wrap-anywhere">
        {announcement ? r.title : (
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="after:absolute after:inset-0">
            {r.title}
          </a>
        )}
      </div>
      {announcement ? (
        <p className="mt-2 font-serif text-sm leading-normal whitespace-pre-line text-[#222]">{r.message}</p>
      ) : (
        <div className="mt-auto flex items-center gap-1 pt-3 font-serif text-sm text-soft">
          <span className="min-w-0 truncate">{resourceHost(r.url ?? "")}</span>
          <ArrowTopRightOnSquareIcon className="size-3.5 shrink-0" strokeWidth={2.5} />
        </div>
      )}
    </div>
  );
}

interface ResourceFormProps {
  circleId: string;
  resource: CircleResource | null;
  onClose: () => void;
  // removing lives here, not on the card, which keeps the board uncluttered
  onRemove: (resource: CircleResource) => void;
}

/* Adding or editing one resource. What it is comes first, since that decides
   what else to fill in: a link for a folder, file or video, a message for an
   announcement. Both are kept while the form is open, so switching kind
   doesn't lose what was typed; only the one the kind uses is saved. */
function ResourceForm({ circleId, resource, onClose, onRemove }: ResourceFormProps) {
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
        <Eyebrow className="text-soft">{resource ? `Edit ${optionFor(resource.icon).label.toLowerCase()}` : "Add item"}</Eyebrow>
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
          {resource && (
            <Button type="button" variant="danger" onClick={() => onRemove(resource)} disabled={busy} className="ml-auto">
              Remove
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
