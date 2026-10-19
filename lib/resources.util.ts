import type { ResourceIcon } from "./types";

/* Validation for a circle resource, shared by the add/edit form (instant
   feedback) and lib/db/resources.ts (the authoritative check — the client is
   never trusted). Pure, so it runs identically in both places. */

export const RESOURCE_TITLE_MAX = 120;
export const RESOURCE_URL_MAX = 2048;
export const RESOURCE_MESSAGE_MAX = 2000;
export const RESOURCE_ICONS: readonly ResourceIcon[] = ["folder", "file", "video", "announcement"];
// each kind's name, as a proposal or an email reads it
export const RESOURCE_KIND_LABEL: Record<ResourceIcon, string> = { folder: "Folder", file: "File", video: "Video", announcement: "Announcement" };

// what the form sends: it keeps both a link and a message as it's edited (so
// switching kind doesn't lose either), and only the one the kind uses is
// checked and saved — an announcement's message, every other kind's link
export interface ResourceInput {
  title: string;
  icon: ResourceIcon;
  url: string;
  message: string;
}

export type ResourceErrors = Partial<Record<keyof ResourceInput, string>>;

// an announcement is a message to the circle; every other kind is a link
export function isAnnouncement(icon: ResourceIcon): boolean {
  return icon === "announcement";
}

// only http(s) links are allowed — anything else (javascript:, data:, ...)
// would run or render as something other than a link to a web page
export function parseResourceUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "http:" || u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

export function validateResourceInput(input: ResourceInput): ResourceErrors {
  const errors: ResourceErrors = {};
  if (!RESOURCE_ICONS.includes(input.icon)) {
    errors.icon = "Pick what kind of item it is.";
    return errors;
  }
  const title = input.title.trim();
  if (!title) errors.title = isAnnouncement(input.icon) ? "Give the announcement a title." : "Give it a title.";
  else if (title.length > RESOURCE_TITLE_MAX) errors.title = `Keep the title under ${RESOURCE_TITLE_MAX} characters.`;
  if (isAnnouncement(input.icon)) {
    const message = input.message.trim();
    if (!message) errors.message = "Write the announcement.";
    else if (message.length > RESOURCE_MESSAGE_MAX) errors.message = `Keep it under ${RESOURCE_MESSAGE_MAX} characters.`;
    return errors;
  }
  const url = input.url.trim();
  if (!url) errors.url = "Add a link.";
  else if (url.length > RESOURCE_URL_MAX) errors.url = "That link is too long.";
  else if (!parseResourceUrl(url)) errors.url = "Use a full web link, starting with http:// or https://.";
  return errors;
}

// the site a link points at, shown under its title (e.g. "drive.google.com")
export function resourceHost(url: string): string {
  return parseResourceUrl(url)?.hostname.replace(/^www\./, "") ?? "";
}
