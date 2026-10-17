"use client";

import { useState } from "react";
import { ArrowTopRightOnSquareIcon, PencilIcon, PlusIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Eyebrow } from "@/components/shared";
import { useAppState } from "@/components/providers/app-state-provider";
import { fmtNumericDate } from "@/lib/format.util";
import { useMemberById } from "@/lib/hooks";
import { isAnnouncement, resourceHost } from "@/lib/resources.util";
import type { CircleResource } from "@/lib/types";
import { isPhoneWidth } from "@/lib/viewport";
import { RemoveResourceConfirm, ResourceFormModal } from "./resource-form";
import { RESOURCE_ICONS, RESOURCE_ICON_TEXT, resourceOption } from "./resource-kinds";

/* A circle's members-only resources: links (a folder, a file, a video) and
   announcements, messages typed out for the circle. The caller (CirclePage)
   only renders this for a member; the data itself is members-only too —
   AppState's `resources` only ever holds the viewer's own circles' (see
   lib/db/resources.ts), so this never has to filter anyone out. Adding,
   editing, and removing save immediately, each as its own change rather than
   part of the Manage form. Its + sits in the circle page's tab row, so that
   page owns whether the add dialog is open (`adding`). On a phone the form is
   a page instead (ResourceFormPage): `onAdd` goes there, and so does editing,
   through `onEditPage`. */
interface BulletinSectionProps {
  circleId: string;
  adding: boolean;
  onAdd: () => void;
  onAddingDone: () => void;
  onEditPage: (resource: CircleResource) => void;
}

export function BulletinSection({ circleId, adding, onAdd, onAddingDone, onEditPage }: BulletinSectionProps) {
  const { resources } = useAppState();
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
            <BulletinCard key={r.id} resource={r} onEdit={() => (isPhoneWidth() ? onEditPage(r) : setEditing(r))} />
          ))}
        </div>
      )}

      {(adding || editing) && (
        <ResourceFormModal
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

      {removing && <RemoveResourceConfirm resource={removing} onCancel={() => setRemoving(null)} onRemoved={() => setRemoving(null)} />}
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
  const Icon = RESOURCE_ICONS[r.icon];
  const announcement = isAnnouncement(r.icon);
  const control = "hit relative z-10 -my-1 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-soft hover:text-ink";
  return (
    <div
      className={clsx(
        "relative flex flex-col border border-t-[3px] border-ink bg-paper p-3.5",
        TYPE_RULE[r.icon],
        announcement ? "col-span-full min-[720px]:col-span-2" : "ink-press",
      )}
    >
      <div className="flex items-center gap-1.5">
        <Icon className={clsx("size-4 shrink-0", RESOURCE_ICON_TEXT[r.icon])} strokeWidth={2} aria-hidden />
        <Eyebrow className={clsx("min-w-0 flex-1 truncate", RESOURCE_ICON_TEXT[r.icon])}>{resourceOption(r.icon).label}</Eyebrow>
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
        <>
          <p className="mt-2 font-serif text-sm leading-normal whitespace-pre-line text-[#222]">{r.message}</p>
          <PostedBy resource={r} />
        </>
      ) : (
        <div className="mt-auto flex items-center gap-1 pt-3 font-serif text-sm text-soft">
          <span className="min-w-0 truncate">{resourceHost(r.url ?? "")}</span>
          <ArrowTopRightOnSquareIcon className="size-3.5 shrink-0" strokeWidth={2.5} />
        </div>
      )}
    </div>
  );
}

// signed like a note: "— Dillon Fagan on 2/24/2026". An item from before
// posters were recorded, or whose poster has since left, shows just the date.
function PostedBy({ resource: r }: { resource: CircleResource }) {
  const memberById = useMemberById();
  const poster = r.createdBy !== undefined ? memberById(r.createdBy) : undefined;
  const date = fmtNumericDate(r.createdAt);
  return (
    <p className="mt-3 font-serif text-sm text-soft">
      {poster ? (
        <>
          — <span className="text-ink">{poster.name}</span> on {date}
        </>
      ) : (
        `Posted on ${date}`
      )}
    </p>
  );
}
