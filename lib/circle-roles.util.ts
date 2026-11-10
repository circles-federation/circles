import type { Circle, CircleRole, CircleType } from "./types";

/* Roles a member can hold inside a circle — Secretary, Leader, and so on. Pure
   rules, shared by the Manage page (instant feedback) and lib/db/circle-roles.ts
   (the authoritative check). Any circle except a neighborhood or the city can
   have them; a role belongs to one circle, has at most one holder, and a member
   can hold several. Using them is optional: every role can be left empty. */

// present on every circle that can have roles, whether or not anyone holds
// them: they can be assigned and cleared but never removed or renamed
export const BUILTIN_CIRCLE_ROLES = ["Secretary", "Leader", "Facilitator", "Delegate"] as const;
type BuiltinRole = (typeof BUILTIN_CIRCLE_ROLES)[number];

// the Delegate represents a circle in the circle above it, so only a circle
// that's accountable to its parent has one: a Circle (type "circle"), not a
// collective or co-op, which govern themselves. Nor can any other circle give
// one of its own roles that name.
export const DELEGATE: BuiltinRole = "Delegate";
// whether `memberId` is this circle's delegate
export function isDelegateOf(circle: Pick<Circle, "roles">, memberId: number): boolean {
  return (circle.roles ?? []).some((r) => r.builtin && r.label === DELEGATE && r.memberId === memberId);
}

export function circleIsAccountable(circle: { type: CircleType }): boolean {
  return circle.type === "circle";
}

// the built-in roles a circle of this type has, in order
export function builtinRolesFor(type: CircleType): BuiltinRole[] {
  return BUILTIN_CIRCLE_ROLES.filter((r) => r !== DELEGATE || circleIsAccountable({ type }));
}

/* What each built-in role looks after, after Sociocracy for All's circle
   roles (sociocracyforall.org/process-roles): in sociocracy a role isn't about
   power but about paying attention to one part of how the circle works.
   Shown under each on Manage circle. */
export const BUILTIN_ROLE_DESCRIPTION: Record<(typeof BUILTIN_CIRCLE_ROLES)[number], string> = {
  Secretary: "Keeps the circle's records and tracks what's due back on the agenda.",
  Leader: "Oversees the circle's work and makes day-to-day decisions between meetings.",
  Facilitator: "Plans the agenda and runs meetings so decisions are made by consent.",
  Delegate: "Represents the circle in its parent circle, and brings back what's decided there.",
};

export const CIRCLE_ROLE_LABEL_MAX = 40;
export const MAX_CUSTOM_CIRCLE_ROLES = 20;

// what the Manage page edits and the server saves: a role's name and who holds
// it, in display order. Whether it's built in is decided by its name, never by
// what a client says.
export interface CircleRoleDraft {
  label: string;
  memberId: number | null;
}

// neighborhoods (a place, whose members are simply its residents), the city root
// don't have roles, and a group only once it switches them on (see
// GROUP_FEATURES in circles.util.ts)
export function circleHasRoles(circle: Pick<Circle, "type" | "parentId" | "features">): boolean {
  return circle.type !== "neighborhood" && circle.parentId !== null && (circle.type !== "group" || !!circle.features?.includes("roles"));
}

const sameLabel = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// the built-in role this name is, for a circle of this type
const builtinLabel = (label: string, type: CircleType) => builtinRolesFor(type).find((b) => sameLabel(b, label));
export const isBuiltinRole = (label: string, type: CircleType) => !!builtinLabel(label, type);
// a built-in role's name that a circle of this type can't use (Delegate, for
// one that isn't accountable to a parent)
const reservedLabel = (label: string, type: CircleType) => BUILTIN_CIRCLE_ROLES.some((b) => sameLabel(b, label)) && !builtinLabel(label, type);

// a built-in role's description, by its name (any case); undefined for a
// circle's own role
export function builtinRoleDescription(label: string): string | undefined {
  const builtin = BUILTIN_CIRCLE_ROLES.find((b) => sameLabel(b, label));
  return builtin ? BUILTIN_ROLE_DESCRIPTION[builtin] : undefined;
}

/* The full, ordered list a circle shows: the built-in roles for its type
   first (always all of them, holders filled in from `saved`), then its own,
   in the order saved. A holder who's no longer a member of the circle counts
   as no holder, and a Delegate saved while it was a Circle is dropped once
   it's become something that has none. */
export function assembleCircleRoles(saved: CircleRoleDraft[], memberIds: number[], type: CircleType): CircleRole[] {
  const holder = (memberId: number | null) => (memberId !== null && memberIds.includes(memberId) ? memberId : null);
  const builtins = builtinRolesFor(type).map((label): CircleRole => ({
    label,
    builtin: true,
    memberId: holder(saved.find((s) => sameLabel(s.label, label))?.memberId ?? null),
  }));
  const own = saved
    .filter((s) => !builtinLabel(s.label, type) && !reservedLabel(s.label, type) && s.label.trim() !== "")
    .map((s): CircleRole => ({ label: s.label.trim(), builtin: false, memberId: holder(s.memberId) }));
  return [...builtins, ...own];
}

// the first problem with a set of roles, or null when it's fine. `memberIds` is
// who's in the circle — a role can only be held by one of them — and `type`
// its type, which decides its built-in roles
export function validateCircleRoles(drafts: CircleRoleDraft[], memberIds: number[], type: CircleType): string | null {
  const seen = new Set<string>();
  let custom = 0;
  for (const d of drafts) {
    const label = d.label.trim();
    if (!label) return "Give every role a name, or remove it.";
    if (label.length > CIRCLE_ROLE_LABEL_MAX) return `Keep role names under ${CIRCLE_ROLE_LABEL_MAX} characters.`;
    const key = label.toLowerCase();
    if (seen.has(key)) return `There are two roles named "${label}".`;
    seen.add(key);
    if (reservedLabel(label, type)) return "Only a Circle, which answers to its parent circle, has a Delegate.";
    if (!builtinLabel(label, type)) custom++;
    if (d.memberId !== null && !memberIds.includes(d.memberId)) return `Only members of this circle can hold a role in it.`;
  }
  if (custom > MAX_CUSTOM_CIRCLE_ROLES) return `Keep it to ${MAX_CUSTOM_CIRCLE_ROLES} added roles or fewer.`;
  return null;
}

// a role a member holds in a circle (built-in or the circle's own), if any —
// holding one lets them schedule the circle's meetings without asking for its
// consent (see createEvent in lib/db/events.ts). The first in the circle's
// order, if they hold several.
export function approvingRole(circle: Pick<Circle, "roles">, memberId: number): string | null {
  return (circle.roles ?? []).find((r) => r.memberId === memberId)?.label ?? null;
}

// the names of the roles a member holds in a circle, in the order the circle
// lists them — what its member card shows in place of their occupation
export function rolesHeldBy(circle: Pick<Circle, "roles">, memberId: number): string[] {
  return (circle.roles ?? []).filter((r) => r.memberId === memberId).map((r) => r.label);
}
