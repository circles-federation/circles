import type { Member } from "./types";

/* the member's uploaded photo, or until they upload one, a deterministic
   placeholder — neutral silhouettes, seeded */
export function avatarFor(m: Member): string {
  if (m.photoVersion) return `/api/members/${m.id}/photo?v=${m.photoVersion}`;
  return placeholderFor(m.id);
}

export function placeholderFor(memberId: number): string {
  return `https://i.pravatar.cc/300?img=${memberId + 8}`;
}

// a new photo waiting for review, which only the member and admins may fetch
export function pendingPhotoFor(memberId: number, version: number): string {
  return `/api/members/${memberId}/photo?pending&v=${version}`;
}

// the decades someone can say they were born in, oldest first
export const PRONOUNS_MAX = 30;
// the pronouns Edit myself offers with a tap; anything else is typed below them
export const PRONOUN_OPTIONS = ["he/him", "she/her", "they/them"] as const;
export const OCCUPATION_MAX = 60;
// every member's profile is sent to every member's browser, so each part is capped
export const MEMBER_NAME_MAX = 60;
export const BIO_MAX = 2_000;
export const MAX_TAGS = 30;
export const TAG_MAX = 40;

// what's wrong with a profile edit's name, bio and tags, or null
export function validateProfileText(p: { name?: string; lastName?: string | null; bio?: string; skills?: string[]; interests?: string[] }): string | null {
  if (p.name !== undefined) {
    if (typeof p.name !== "string" || !p.name.trim()) return "Enter your name.";
    if (p.name.trim().length > MEMBER_NAME_MAX) return `Keep your name under ${MEMBER_NAME_MAX} characters.`;
  }
  if (p.lastName != null && (typeof p.lastName !== "string" || p.lastName.trim().length > MEMBER_NAME_MAX)) return `Keep your last name under ${MEMBER_NAME_MAX} characters.`;
  if (p.bio !== undefined && (typeof p.bio !== "string" || p.bio.length > BIO_MAX)) return `Keep your bio under ${BIO_MAX} characters.`;
  for (const [label, tags] of [["skills", p.skills], ["interests", p.interests]] as const) {
    if (tags === undefined) continue;
    if (!Array.isArray(tags) || tags.some((t) => typeof t !== "string")) return `Those ${label} weren't recognized.`;
    if (tags.length > MAX_TAGS) return `Keep ${label} to ${MAX_TAGS} or fewer.`;
    if (tags.some((t) => t.length > TAG_MAX)) return `Keep each of your ${label} under ${TAG_MAX} characters.`;
  }
  return null;
}

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

/* Suggestions for a member's skills or interests as they're typed, from what
   other members have already added, so the same thing is called the same
   thing (and can be counted together). `pool` is every entry of that kind
   across members, repeats included; entries that differ only in case are one,
   shown in their most common form. A match contains what's typed: ones that
   start with it first, then the most used, then A–Z. Nothing already chosen
   is suggested. */
export function tagSuggestions(pool: string[], query: string, chosen: string[], limit = 6): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const taken = new Set(chosen.map((c) => c.trim().toLowerCase()));
  return tagCounts(pool)
    .filter((t) => t.key.includes(q) && !taken.has(t.key))
    .sort((a, b) => Number(b.key.startsWith(q)) - Number(a.key.startsWith(q)) || b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map((t) => t.label);
}

// what's typed, as the form other members already use for it if there's one
// (any case), so "permaculture" joins "Permaculture" rather than splitting it
export function canonicalTag(value: string, pool: string[]): string {
  const key = value.trim().toLowerCase();
  return tagCounts(pool).find((t) => t.key === key)?.label ?? value.trim();
}

// each distinct entry (case aside), how many members use it, and its most
// common spelling
function tagCounts(pool: string[]): { key: string; label: string; count: number }[] {
  const byKey = new Map<string, Map<string, number>>();
  for (const raw of pool) {
    const label = raw.trim();
    if (!label) continue;
    const forms = byKey.get(label.toLowerCase()) ?? new Map<string, number>();
    forms.set(label, (forms.get(label) ?? 0) + 1);
    byKey.set(label.toLowerCase(), forms);
  }
  return [...byKey].map(([key, forms]) => {
    // the most used; on a tie, the capitalised one ("Permaculture" over "permaculture")
    const capital = (form: string) => Number(/^\p{Lu}/u.test(form));
    const [label] = [...forms].sort((a, b) => b[1] - a[1] || capital(b[0]) - capital(a[0]) || a[0].localeCompare(b[0]))[0]!;
    return { key, label, count: [...forms.values()].reduce((n, c) => n + c, 0) };
  });
}
