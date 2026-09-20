import type { ResourceIcon } from "./types";

/* Validation for a circle resource, shared by the add/edit form (instant
   feedback) and lib/db/resources.ts (the authoritative check — the client is
   never trusted). Pure, so it runs identically in both places. */

export const RESOURCE_TITLE_MAX = 120;
export const RESOURCE_URL_MAX = 2048;
export const RESOURCE_ICONS: readonly ResourceIcon[] = ["folder", "file"];

export interface ResourceInput {
  title: string;
  url: string;
  icon: ResourceIcon;
}

export type ResourceErrors = Partial<Record<keyof ResourceInput, string>>;

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
  const title = input.title.trim();
  if (!title) errors.title = "Give the resource a title.";
  else if (title.length > RESOURCE_TITLE_MAX) errors.title = `Keep the title under ${RESOURCE_TITLE_MAX} characters.`;
  const url = input.url.trim();
  if (!url) errors.url = "Add a link.";
  else if (url.length > RESOURCE_URL_MAX) errors.url = "That link is too long.";
  else if (!parseResourceUrl(url)) errors.url = "Use a full web link, starting with http:// or https://.";
  if (!RESOURCE_ICONS.includes(input.icon)) errors.icon = "Pick folder or file.";
  return errors;
}

// the site a link points at, shown under its title (e.g. "drive.google.com")
export function resourceHost(url: string): string {
  return parseResourceUrl(url)?.hostname.replace(/^www\./, "") ?? "";
}
