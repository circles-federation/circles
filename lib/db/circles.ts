import { and, eq, inArray } from "drizzle-orm";
import { db } from "./client";
import { UserFacingError } from "./errors";
import { circleMembers, circleRoles, circles } from "./schema";
import { groupBy } from "./util";
import { assembleCircleRoles, circleHasRoles, type CircleRoleDraft } from "@/lib/circle-roles.util";
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

export async function getCircles(): Promise<Circle[]> {
  const rows = await db.select().from(circles);
  return attachMembers(rows);
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
