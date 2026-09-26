import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "./client";
import { UserFacingError } from "./errors";
import { circleMembers, circleResources, circles } from "./schema";
import { isAnnouncement, validateResourceInput, type ResourceInput } from "@/lib/resources.util";
import type { CircleResource } from "@/lib/types";

/* Circle resources are members-only, so this file is where that's enforced —
   not the UI, and not the caller. Reads only ever return resources for
   circles the given member belongs to; every write re-checks membership and
   re-validates input here, so it holds no matter who calls it (lib/db/
   actions.ts passes the signed-in member from the session). Kept free of any
   session/request access so it can be exercised directly. */

export class ResourceError extends UserFacingError {}

type ResourceRow = typeof circleResources.$inferSelect;

function toResource(row: ResourceRow): CircleResource {
  return {
    id: row.id,
    circleId: row.circleId,
    title: row.title,
    icon: row.icon,
    ...(row.url !== null ? { url: row.url } : {}),
    ...(row.message !== null ? { message: row.message } : {}),
    createdAt: row.createdAt.toISOString(),
    ...(row.createdBy !== null ? { createdBy: row.createdBy } : {}),
  };
}

// every resource of every circle this member belongs to, newest first —
// what the app sends to the browser, so a non-member never receives a circle's
export async function getResourcesForMember(memberId: number): Promise<CircleResource[]> {
  const rows = await db
    .select({ resource: circleResources })
    .from(circleResources)
    .innerJoin(circleMembers, and(eq(circleMembers.circleId, circleResources.circleId), eq(circleMembers.memberId, memberId)))
    .orderBy(desc(circleResources.createdAt));
  return rows.map((r) => toResource(r.resource));
}

// resources live on a circle's detail page, so they don't apply to a
// neighborhood (which renders as a folder view), and only its members manage them
async function assertCanManage(memberId: number, circleId: string) {
  const [circle] = await db.select({ type: circles.type }).from(circles).where(eq(circles.id, circleId));
  if (!circle) throw new ResourceError("That circle doesn't exist.");
  if (circle.type === "neighborhood") throw new ResourceError("Neighborhoods don't have a bulletin.");
  const [membership] = await db
    .select({ memberId: circleMembers.memberId })
    .from(circleMembers)
    .where(and(eq(circleMembers.circleId, circleId), eq(circleMembers.memberId, memberId)));
  if (!membership) throw new ResourceError("Only members of this circle can change its bulletin.");
}

// only what the kind uses is saved, and the other is cleared — so a resource
// changed from a link to an announcement (or back) keeps nothing stale, which
// the table's own check constraint also insists on
function cleanInput(input: ResourceInput): { title: string; icon: ResourceInput["icon"]; url: string | null; message: string | null } {
  const first = Object.values(validateResourceInput(input))[0];
  if (first) throw new ResourceError(first);
  const announcement = isAnnouncement(input.icon);
  return {
    title: input.title.trim(),
    icon: input.icon,
    url: announcement ? null : input.url.trim(),
    message: announcement ? input.message.trim() : null,
  };
}

async function loadResource(id: string): Promise<ResourceRow> {
  const [row] = await db.select().from(circleResources).where(eq(circleResources.id, id));
  if (!row) throw new ResourceError("That item is no longer on the bulletin.");
  return row;
}

export async function createResource(memberId: number, circleId: string, input: ResourceInput): Promise<CircleResource> {
  await assertCanManage(memberId, circleId);
  const clean = cleanInput(input);
  const [row] = await db.insert(circleResources).values({ id: randomUUID(), circleId, createdBy: memberId, ...clean }).returning();
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
