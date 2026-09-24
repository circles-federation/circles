import type { Member } from "./types";

/* the member's uploaded photo, or until they upload one, a deterministic
   placeholder — neutral silhouettes, seeded */
export function avatarFor(m: Member): string {
  if (m.photoVersion) return `/api/members/${m.id}/photo?v=${m.photoVersion}`;
  return `https://i.pravatar.cc/300?img=${m.id + 8}`;
}
