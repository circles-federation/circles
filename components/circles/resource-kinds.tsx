import { DocumentIcon, FolderIcon, MegaphoneIcon, VideoCameraIcon } from "@heroicons/react/24/outline";
import type { ResourceIcon } from "@/lib/types";

/* The kinds of thing a circle's bulletin holds, shared by its board
   (bulletin-section.tsx) and the form that adds or edits one
   (resource-form.tsx). */
export const RESOURCE_ICONS = { folder: FolderIcon, file: DocumentIcon, video: VideoCameraIcon, announcement: MegaphoneIcon };

// each type gets its own color so what a resource is reads at a glance —
// folders yellow, files blue, videos purple, announcements red. Full literal
// class strings (not interpolated) so Tailwind's static scan sees them.
export const RESOURCE_ICON_TEXT = { folder: "text-folder", file: "text-file", video: "text-video", announcement: "text-announcement" };

export const RESOURCE_OPTIONS: { key: ResourceIcon; label: string; hint: string; titlePlaceholder: string }[] = [
  { key: "folder", label: "Folder", hint: "A collection, like a shared drive", titlePlaceholder: "e.g. Shared drive" },
  { key: "file", label: "File", hint: "A single document", titlePlaceholder: "e.g. Meeting notes" },
  { key: "video", label: "Video", hint: "A recording or a livestream", titlePlaceholder: "e.g. Last month's meeting" },
  { key: "announcement", label: "Announcement", hint: "A message for members", titlePlaceholder: "e.g. Garden workday moved to Sunday" },
];

export const resourceOption = (icon: ResourceIcon) => RESOURCE_OPTIONS.find((o) => o.key === icon) ?? RESOURCE_OPTIONS[0]!;

// the form's title, and the top bar's on its page
export const resourceFormTitle = (icon: ResourceIcon | undefined) => (icon ? `Edit ${resourceOption(icon).label.toLowerCase()}` : "Add item");
