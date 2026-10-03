import { and, eq, inArray, like, or } from "drizzle-orm";
import { db } from "./client";
import { UserFacingError } from "./errors";
import { circleMembers, circleRoles, circles } from "./schema";
import { groupBy } from "./util";
import { assembleCircleRoles, circleHasRoles, type CircleRoleDraft } from "@/lib/circle-roles.util";
import { validateNewCircle, type NewCircleInput } from "@/lib/circles.util";
import type { Circle } from "@/lib/types";

type CircleRow = typeof circles.$inferSelect;

export class CircleError extends UserFacingError {}

function toCircle(row: CircleRow, memberIds: number[], savedRoles: CircleRoleDraft[]): Circle {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    parentId: row.parentId,
    tagline: row.tagline,
    about: row.about,
    offers: row.offers,
    needs: row.needs,
    members: memberIds,
    ...(circleHasRoles(row) ? { roles: assembleCircleRoles(savedRoles, memberIds) } : {}),
    lastEditedBy: row.lastEditedBy ?? undefined,
    lastEditedAt: row.lastEditedAt ? row.lastEditedAt.toISOString() : undefined,
    facts: row.facts,
    join: row.join ?? undefined,
    contact: row.contact ?? undefined,
    website: row.website ?? undefined,
    address: row.address ?? undefined,
    hours: row.hours ?? undefined,
  };
}

async function attachMembers(rows: CircleRow[]): Promise<Circle[]> {
  if (rows.length === 0) return [];
  const [memberRows, roleRows] = await Promise.all([
    db.select().from(circleMembers),
    db.select().from(circleRoles).orderBy(circleRoles.position),
  ]);
  const membersByCircle = groupBy(memberRows, (r) => r.circleId, (r) => r.memberId);
  const rolesByCircle = groupBy(roleRows, (r) => r.circleId, (r): CircleRoleDraft => ({ label: r.label, memberId: r.memberId }));
  return rows.map((row) => toCircle(row, membersByCircle.get(row.id) || [], rolesByCircle.get(row.id) || []));
}

/* Every circle this member may know of: all of them, except a group they
   don't belong to — a group is private to its members (see isGroup in
   lib/circles.util.ts), so it, and its roster, never reach anyone else's
   browser. What AppState is seeded and refreshed with. */
export async function getCirclesForMember(memberId: number): Promise<Circle[]> {
  const rows = await db.select().from(circles);
  const all = await attachMembers(rows);
  return all.filter((c) => c.type !== "group" || c.members.includes(memberId));
}

export async function getCircleById(id: string): Promise<Circle | null> {
  const [row] = await db.select().from(circles).where(eq(circles.id, id));
  if (!row) return null;
  const [full] = await attachMembers([row]);
  return full ?? null;
}

export async function getCirclesByMember(memberId: number): Promise<Circle[]> {
  const memberships = await db.select({ circleId: circleMembers.circleId }).from(circleMembers).where(eq(circleMembers.memberId, memberId));
  const ids = memberships.map((m) => m.circleId);
  if (ids.length === 0) return [];
  const rows = await db.select().from(circles).where(inArray(circles.id, ids));
  return attachMembers(rows);
}

/* Edit a circle's own page — member-gated, the same right `lib/db/circle-
   roles.ts`'s setCircleRoles already requires: `memberId` must belong to the
   circle being edited. Membership itself isn't editable through this generic
   patch — a client-supplied `members` key is silently dropped, same as
   `roles` — both have their own authorized write path (circle-roles.ts for
   roles; there is no membership-editing UI yet, so that door simply doesn't
   exist here). */
export async function updateCircle(memberId: number, id: string, patch: Partial<Circle>): Promise<Circle | null> {
  const [circle] = await db.select().from(circles).where(eq(circles.id, id));
  if (!circle) throw new CircleError("That circle doesn't exist.");
  const [membership] = await db.select().from(circleMembers).where(and(eq(circleMembers.circleId, id), eq(circleMembers.memberId, memberId))).limit(1);
  if (!membership) throw new CircleError(`Only members of ${circle.name} can edit its page.`);

  // becoming a group, or ceasing to be one, would hide a circle from everyone
  // outside it, or reveal a private one — a group's type is fixed
  if (patch.type !== undefined && patch.type !== circle.type && (patch.type === "group" || circle.type === "group")) {
    throw new CircleError("A group can't become another kind of circle, and a circle can't become a group.");
  }
  // Other is kept by a circle that's already Other, never chosen
  if (patch.type === "other" && circle.type !== "other") {
    throw new CircleError("Choose what kind of circle this is.");
  }
  const { members: _members, roles: _roles, lastEditedAt, ...columnPatch } = patch;
  if (Object.keys(columnPatch).length > 0 || lastEditedAt !== undefined) {
    await db
      .update(circles)
      .set({
        ...columnPatch,
        ...(lastEditedAt !== undefined ? { lastEditedAt: new Date(lastEditedAt) } : {}),
      })
      .where(eq(circles.id, id));
  }
  return getCircleById(id);
}

// ids that are a route of their own under /circles, so can't name a circle
const RESERVED_IDS = new Set(["new"]);

// "Saturday Garden Crew!" → "saturday-garden-crew", the shape every circle's id
// (and so its URL) has
function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return slug || "circle";
}

/* A new circle, created by `memberId` (Create circle), who becomes its first
   member — for a group, the only one who knows it exists until they invite
   someone. Validated with the form's own check (validateNewCircle), which
   also limits its parent to a neighborhood or the city. Its id is the name's
   slug, with -2, -3… added if that's taken (or reserved), and it starts
   with the creator as its last editor. The rest of its page (about, offers,
   facts…) is filled in from Manage circle. */
export async function createCircle(memberId: number, input: NewCircleInput): Promise<Circle> {
  const problem = validateNewCircle(input, await getCirclesForMember(memberId));
  if (problem) throw new CircleError(problem);
  const base = slugify(input.name);
  const id = await db.transaction(async (tx) => {
    const taken = new Set(
      (await tx.select({ id: circles.id }).from(circles).where(or(eq(circles.id, base), like(circles.id, `${base}-%`)))).map((r) => r.id)
    );
    let id = base;
    for (let n = 2; taken.has(id) || RESERVED_IDS.has(id); n++) id = `${base}-${n}`;
    await tx.insert(circles).values({
      id,
      type: input.type,
      name: input.name.trim(),
      parentId: input.parentId,
      tagline: input.tagline.trim(),
      about: "",
      lastEditedBy: memberId,
      lastEditedAt: new Date(),
    });
    await tx.insert(circleMembers).values({ circleId: id, circleType: input.type, memberId });
    return id;
  });
  const created = await getCircleById(id);
  if (!created) throw new CircleError("The circle couldn't be created. Try again.");
  return created;
}
