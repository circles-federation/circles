import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { db } from "./client";
import { circleMembers, circleResources, circles } from "./schema";
import { validateResourceInput, type ResourceInput } from "@/lib/resources.util";
import type { CircleResource } from "@/lib/types";

/* Circle resources are members-only, so this file is where that's enforced —
   not the UI, and not the caller. Reads only ever return resources for
   circles the given member belongs to; every write re-checks membership and
   re-validates input here, so it holds no matter who calls it (lib/db/
   actions.ts passes the signed-in member from the session). Kept free of any
   session/request access so it can be exercised directly. */

export class ResourceError extends Error {}

type ResourceRow = typeof circleResources.$inferSelect;

function toResource(row: ResourceRow): CircleResource {
  return { id: row.id, circleId: row.circleId, title: row.title, url: row.url, icon: row.icon };
}

// every resource of every circle this member belongs to, in the order added —
// what the app sends to the browser, so a non-member never receives a circle's
export async function getResourcesForMember(memberId: number): Promise<CircleResource[]> {
  const rows = await db
    .select({ resource: circleResources })
    .from(circleResources)
    .innerJoin(circleMembers, and(eq(circleMembers.circleId, circleResources.circleId), eq(circleMembers.memberId, memberId)))
    .orderBy(asc(circleResources.createdAt));
  return rows.map((r) => toResource(r.resource));
}

// resources live on a circle's detail page, so they don't apply to a
// neighborhood (which renders as a folder view), and only its members manage them
async function assertCanManage(memberId: number, circleId: string) {
  const [circle] = await db.select({ type: circles.type }).from(circles).where(eq(circles.id, circleId));
  if (!circle) throw new ResourceError("That circle doesn't exist.");
  if (circle.type === "neighborhood") throw new ResourceError("Neighborhoods don't have resources.");
  const [membership] = await db
    .select({ memberId: circleMembers.memberId })
    .from(circleMembers)
    .where(and(eq(circleMembers.circleId, circleId), eq(circleMembers.memberId, memberId)));
  if (!membership) throw new ResourceError("Only members of this circle can manage its resources.");
}

function cleanInput(input: ResourceInput): ResourceInput {
  const first = Object.values(validateResourceInput(input))[0];
  if (first) throw new ResourceError(first);
  return { title: input.title.trim(), url: input.url.trim(), icon: input.icon };
}

async function loadResource(id: string): Promise<ResourceRow> {
  const [row] = await db.select().from(circleResources).where(eq(circleResources.id, id));
  if (!row) throw new ResourceError("That resource no longer exists.");
  return row;
}

export async function createResource(memberId: number, circleId: string, input: ResourceInput): Promise<CircleResource> {
  await assertCanManage(memberId, circleId);
  const clean = cleanInput(input);
  const [row] = await db.insert(circleResources).values({ id: randomUUID(), circleId, ...clean }).returning();
  return toResource(row!);
}

export async function updateResource(memberId: number, id: string, input: ResourceInput): Promise<CircleResource> {
  const existing = await loadResource(id);
  await assertCanManage(memberId, existing.circleId);
  const clean = cleanInput(input);
  const [row] = await db.update(circleResources).set(clean).where(eq(circleResources.id, id)).returning();
  return toResource(row!);
}

export async function deleteResource(memberId: number, id: string): Promise<void> {
  const existing = await loadResource(id);
  await assertCanManage(memberId, existing.circleId);
  await db.delete(circleResources).where(eq(circleResources.id, id));
}
