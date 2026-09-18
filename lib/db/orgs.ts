import { eq, inArray } from "drizzle-orm";
import { db } from "./client";
import { orgMembers, orgs } from "./schema";
import { groupBy } from "./util";
import type { Org } from "@/lib/types";

type OrgRow = typeof orgs.$inferSelect;

function toOrg(row: OrgRow, memberIds: number[]): Org {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    parentId: row.parentId,
    neighborhood: row.neighborhood ?? undefined,
    tagline: row.tagline,
    about: row.about,
    offers: row.offers,
    members: memberIds,
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

async function attachMembers(rows: OrgRow[]): Promise<Org[]> {
  if (rows.length === 0) return [];
  const memberRows = await db.select().from(orgMembers);
  const membersByOrg = groupBy(memberRows, (r) => r.orgId, (r) => r.memberId);
  return rows.map((row) => toOrg(row, membersByOrg.get(row.id) || []));
}

export async function getOrgs(): Promise<Org[]> {
  const rows = await db.select().from(orgs);
  return attachMembers(rows);
}

export async function getOrgById(id: string): Promise<Org | null> {
  const [row] = await db.select().from(orgs).where(eq(orgs.id, id));
  if (!row) return null;
  const [full] = await attachMembers([row]);
  return full ?? null;
}

export async function getOrgsByMember(memberId: number): Promise<Org[]> {
  const memberships = await db.select({ orgId: orgMembers.orgId }).from(orgMembers).where(eq(orgMembers.memberId, memberId));
  const ids = memberships.map((m) => m.orgId);
  if (ids.length === 0) return [];
  const rows = await db.select().from(orgs).where(inArray(orgs.id, ids));
  return attachMembers(rows);
}

export async function updateOrg(id: string, patch: Partial<Org>): Promise<Org | null> {
  const { members: memberPatch, lastEditedAt, ...columnPatch } = patch;
  await db.transaction(async (tx) => {
    if (Object.keys(columnPatch).length > 0 || lastEditedAt !== undefined) {
      await tx
        .update(orgs)
        .set({
          ...columnPatch,
          ...(lastEditedAt !== undefined ? { lastEditedAt: new Date(lastEditedAt) } : {}),
        })
        .where(eq(orgs.id, id));
    }
    if (memberPatch !== undefined) {
      await tx.delete(orgMembers).where(eq(orgMembers.orgId, id));
      if (memberPatch.length > 0) {
        await tx.insert(orgMembers).values(memberPatch.map((memberId) => ({ orgId: id, memberId })));
      }
    }
  });
  return getOrgById(id);
}
