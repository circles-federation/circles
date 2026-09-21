import type { Circle, CircleRole } from "./types";

/* Roles a member can hold inside a circle — Secretary, Leader, and so on. Pure
   rules, shared by the Manage page (instant feedback) and lib/db/circle-roles.ts
   (the authoritative check). Any circle except a neighborhood or the city can
   have them; a role belongs to one circle, has at most one holder, and a member
   can hold several. Using them is optional: every role can be left empty. */

// present on every circle that can have roles, whether or not anyone holds
// them: they can be assigned and cleared but never removed or renamed
export const BUILTIN_CIRCLE_ROLES = ["Secretary", "Leader", "Facilitator"] as const;

export const CIRCLE_ROLE_LABEL_MAX = 40;
export const MAX_CUSTOM_CIRCLE_ROLES = 20;

// what the Manage page edits and the server saves: a role's name and who holds
// it, in display order. Whether it's built in is decided by its name, never by
// what a client says.
export interface CircleRoleDraft {
  label: string;
  memberId: number | null;
}

// neighborhoods (a place, whose members are simply its residents) and the city
// root don't have roles
export function circleHasRoles(circle: Pick<Circle, "type" | "parentId">): boolean {
  return circle.type !== "neighborhood" && circle.parentId !== null;
}

const sameLabel = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const builtinLabel = (label: string) => BUILTIN_CIRCLE_ROLES.find((b) => sameLabel(b, label));

/* The full, ordered list a circle shows: the built-in roles first (always all
   of them, holders filled in from `saved`), then its own, in the order saved.
   A holder who's no longer a member of the circle counts as no holder. */
export function assembleCircleRoles(saved: CircleRoleDraft[], memberIds: number[]): CircleRole[] {
  const holder = (memberId: number | null) => (memberId !== null && memberIds.includes(memberId) ? memberId : null);
  const builtins = BUILTIN_CIRCLE_ROLES.map((label): CircleRole => ({
    label,
    builtin: true,
    memberId: holder(saved.find((s) => sameLabel(s.label, label))?.memberId ?? null),
  }));
  const own = saved
    .filter((s) => !builtinLabel(s.label) && s.label.trim() !== "")
    .map((s): CircleRole => ({ label: s.label.trim(), builtin: false, memberId: holder(s.memberId) }));
  return [...builtins, ...own];
}

// the first problem with a set of roles, or null when it's fine. `memberIds` is
// who's in the circle — a role can only be held by one of them
export function validateCircleRoles(drafts: CircleRoleDraft[], memberIds: number[]): string | null {
  const seen = new Set<string>();
  let custom = 0;
  for (const d of drafts) {
    const label = d.label.trim();
    if (!label) return "Give every role a name, or remove it.";
    if (label.length > CIRCLE_ROLE_LABEL_MAX) return `Keep role names under ${CIRCLE_ROLE_LABEL_MAX} characters.`;
    const key = label.toLowerCase();
    if (seen.has(key)) return `There are two roles named "${label}".`;
    seen.add(key);
    if (!builtinLabel(label)) custom++;
    if (d.memberId !== null && !memberIds.includes(d.memberId)) return `Only members of this circle can hold a role in it.`;
  }
  if (custom > MAX_CUSTOM_CIRCLE_ROLES) return `Keep it to ${MAX_CUSTOM_CIRCLE_ROLES} added roles or fewer.`;
  return null;
}

// the names of the roles a member holds in a circle, in the order the circle
// lists them — what its member card shows in place of their occupation
export function rolesHeldBy(circle: Pick<Circle, "roles">, memberId: number): string[] {
  return (circle.roles ?? []).filter((r) => r.memberId === memberId).map((r) => r.label);
}
