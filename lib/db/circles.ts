import { eq, inArray } from "drizzle-orm";
import { db } from "./client";
import { circleMembers, circleRoles, circles } from "./schema";
import { groupBy } from "./util";
import { assembleCircleRoles, circleHasRoles, type CircleRoleDraft } from "@/lib/circle-roles.util";
import type { Circle } from "@/lib/types";

type CircleRow = typeof circles.$inferSelect;

function toCircle(row: CircleRow, memberIds: number[], savedRoles: CircleRoleDraft[]): Circle {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    parentId: row.parentId,
    tagline: row.tagline,
    about: row.about,
    offers: row.offers,
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

export async function updateCircle(id: string, patch: Partial<Circle>): Promise<Circle | null> {
  const { members: memberPatch, lastEditedAt, ...columnPatch } = patch;
  // roles have their own authorized write (lib/db/circle-roles.ts) — never through this one
  delete columnPatch.roles;
  await db.transaction(async (tx) => {
    if (Object.keys(columnPatch).length > 0 || lastEditedAt !== undefined) {
      await tx
        .update(circles)
        .set({
          ...columnPatch,
          ...(lastEditedAt !== undefined ? { lastEditedAt: new Date(lastEditedAt) } : {}),
        })
        .where(eq(circles.id, id));
    }
    if (memberPatch !== undefined) {
      // membership rows carry their circle's type (see circle_members' composite FK)
      const [circle] = await tx.select({ type: circles.type }).from(circles).where(eq(circles.id, id));
      if (circle) {
        await tx.delete(circleMembers).where(eq(circleMembers.circleId, id));
        if (memberPatch.length > 0) {
          await tx.insert(circleMembers).values(memberPatch.map((memberId) => ({ circleId: id, circleType: circle.type, memberId })));
        }
      }
    }
  });
  return getCircleById(id);
}
