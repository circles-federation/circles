import type { Member } from "./types";

/* the member's uploaded photo, or until they upload one, a deterministic
   placeholder — neutral silhouettes, seeded */
export function avatarFor(m: Member): string {
  if (m.photoVersion) return `/api/members/${m.id}/photo?v=${m.photoVersion}`;
  return `https://i.pravatar.cc/300?img=${m.id + 8}`;
}

// the decades someone can say they were born in, oldest first
export const PRONOUNS_MAX = 30;
export const OCCUPATION_MAX = 60;

export const BIRTH_DECADES = [1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010] as const;

export function isBirthDecade(value: unknown): value is number {
  return typeof value === "number" && (BIRTH_DECADES as readonly number[]).includes(value);
}

// "'90s" for 1990; written in full from 2000 on, since "'00s" and "'10s"
// would read as the 1900s and 1910s just as well
export function birthDecadeLabel(decade: number): string {
  return decade >= 2000 ? `${decade}s` : `'${String(decade).slice(2)}s`;
}

// nothing filled in beyond what applying gave them (name, photo,
// neighborhood): what Home's profile prompt waits on
export function isProfileBlank(m: Member): boolean {
  return !m.pronouns.trim() && !m.role.trim() && !m.bio.trim() && m.skills.length === 0 && m.interests.length === 0 && !m.languages?.length && m.birthDecade === undefined;
}
