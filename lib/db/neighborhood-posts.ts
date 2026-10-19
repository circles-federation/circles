import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNotNull, ne, or } from "drizzle-orm";
import { db, type Tx } from "./client";
import { getCirclesForMember } from "./circles";
import { UserFacingError } from "./errors";
import { enqueueNeighborhoodNotifications } from "./notifications";
import { openPostProposal, withdrawPostProposal } from "./proposals";
import { cleanInput } from "./resources";
import { circleMembers, neighborhoodPosts } from "./schema";
import { circleNeighborhood, indexCircles } from "@/lib/circles.util";
import type { ResourceInput } from "@/lib/resources.util";
import type { NeighborhoodPost } from "@/lib/types";

/* A neighborhood's bulletin: posts by the Circles inside it, each consented
   to by its circle first (a "post" proposal, lib/db/proposals.ts), then seen
   by the neighborhood's residents and told to them in their daily digest.
   Like a circle's bulletin, it's the server that keeps it to them: a member
   is only ever sent the posts of their own neighborhood (and their own
   circles'). A post is the same kinds as a bulletin item, a link or an
   announcement, and isn't edited once it's up: what's posted is what the
   circle consented to. Any member of the posting circle can take it down. */

export class PostError extends UserFacingError {}

type PostRow = typeof neighborhoodPosts.$inferSelect;

function toPost(row: PostRow): NeighborhoodPost {
  return {
    id: row.id,
    neighborhoodId: row.neighborhoodId,
    circleId: row.circleId,
    title: row.title,
    icon: row.icon,
    ...(row.url !== null ? { url: row.url } : {}),
    ...(row.message !== null ? { message: row.message } : {}),
    createdAt: row.createdAt.toISOString(),
    ...(row.createdBy !== null ? { createdBy: row.createdBy } : {}),
    publishedAt: (row.publishedAt ?? row.createdAt).toISOString(),
  };
}

const myCircles = (memberId: number) => db.select({ id: circleMembers.circleId }).from(circleMembers).where(eq(circleMembers.memberId, memberId));

// the published posts of the neighborhood this member lives in, and those
// their own circles have made anywhere, newest first: AppState's
// `neighborhoodPosts`
export async function getNeighborhoodPostsForMember(memberId: number): Promise<NeighborhoodPost[]> {
  const rows = await db
    .select()
    .from(neighborhoodPosts)
    .where(and(isNotNull(neighborhoodPosts.publishedAt), or(inArray(neighborhoodPosts.neighborhoodId, myCircles(memberId)), inArray(neighborhoodPosts.circleId, myCircles(memberId)))))
    .orderBy(desc(neighborhoodPosts.publishedAt));
  return rows.map(toPost);
}

/* Propose a post to the bulletin of the neighborhood `circleId` sits in, as
   `memberId`, one of its members: only a Circle (type "circle") inside a
   neighborhood may, which is why a neighborhood consents to each new one. Saved
   unpublished, with its proposal, in one transaction; a circle of one posts
   it at once. */
export async function proposeNeighborhoodPost(memberId: number, circleId: string, input: ResourceInput): Promise<{ proposalId: string; published: boolean }> {
  const circles = await getCirclesForMember(memberId);
  const byId = indexCircles(circles);
  const circle = byId[circleId];
  if (!circle || !circle.members.includes(memberId)) throw new PostError("Only a circle's members can post for it.");
  const neighborhood = circleNeighborhood(circle, byId);
  if (circle.type !== "circle" || !neighborhood || neighborhood.id === circle.id) throw new PostError("Only a Circle inside a neighborhood can post to its bulletin.");
  const clean = cleanInput(input);
  return db.transaction(async (tx) => {
    const [post] = await tx
      .insert(neighborhoodPosts)
      .values({ id: randomUUID(), neighborhoodId: neighborhood.id, circleId, createdBy: memberId, ...clean })
      .returning();
    const proposalId = await openPostProposal(tx, memberId, toPost(post!), neighborhood.name);
    const [after] = await tx.select({ publishedAt: neighborhoodPosts.publishedAt }).from(neighborhoodPosts).where(eq(neighborhoodPosts.id, post!.id));
    return { proposalId, published: !!after?.publishedAt };
  });
}

/* Its circle consented: it goes up, and every resident but whoever posted it
   is told in their next digest. In the transaction that passes its proposal. */
export async function publishPost(tx: Tx, postId: string): Promise<void> {
  const [post] = await tx.update(neighborhoodPosts).set({ publishedAt: new Date() }).where(eq(neighborhoodPosts.id, postId)).returning();
  if (!post) return;
  const residents = await tx
    .select({ id: circleMembers.memberId })
    .from(circleMembers)
    .where(and(eq(circleMembers.circleId, post.neighborhoodId), post.createdBy !== null ? ne(circleMembers.memberId, post.createdBy) : undefined));
  await enqueueNeighborhoodNotifications(tx, { postId }, residents.map((r) => r.id));
}

// an objection, or a withdrawal: never posted, so it simply goes (its
// proposal keeps what it said)
export async function discardPost(tx: Tx, postId: string): Promise<void> {
  await tx.delete(neighborhoodPosts).where(eq(neighborhoodPosts.id, postId));
}

/* Take a post down, or withdraw one still waiting on its circle: any member
   of the posting circle may. Locked, so it can't pass while it's going. */
export async function removeNeighborhoodPost(memberId: number, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [post] = await tx.select().from(neighborhoodPosts).where(eq(neighborhoodPosts.id, id)).for("update");
    if (!post) throw new PostError("That post is no longer on the bulletin.");
    const [membership] = await tx
      .select({ id: circleMembers.memberId })
      .from(circleMembers)
      .where(and(eq(circleMembers.circleId, post.circleId), eq(circleMembers.memberId, memberId)));
    if (!membership) throw new PostError("Only members of the circle that posted it can take it down.");
    if (!post.publishedAt) await withdrawPostProposal(tx, id);
    await tx.delete(neighborhoodPosts).where(eq(neighborhoodPosts.id, id));
  });
}
