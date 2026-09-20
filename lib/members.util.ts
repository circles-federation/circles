import type { Member } from "./types";

/* deterministic avatar per member — neutral silhouettes, seeded */
export function avatarFor(m: Member): string {
  return `https://i.pravatar.cc/300?img=${m.id + 8}`;
}
