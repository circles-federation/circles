import { randomUUID } from "node:crypto";
import { and, eq, ne, or } from "drizzle-orm";
import type { Tx } from "./client";
import { circleMembers, circleRoles, circles } from "./schema";
import { assembleCircleRoles, type CircleRoleDraft } from "@/lib/circle-roles.util";
import { circleCanHaveCircles } from "@/lib/circles.util";
import type { CircleRole, CircleType } from "@/lib/types";

/* Replace a circle's roles — the one write path for them, called only when a
   proposal to change them passes (lib/db/proposals.ts): who holds a role is
   the circle's members' to decide, by consent. Circles are public (every
   signed-in member is sent all of them, roles included), so reading needs no
   check.

   It's given what was agreed — each role's name and holder, in order — and
   decides the rest: the built-in roles are always kept (a missing one is just
   empty; they can't be removed or renamed), everything else is the circle's
   own, and a holder who's no longer a member of the circle is left out.
   Returns the roles as saved. Its delegate's place in the circle it was
   started inside follows (syncDelegate). */
export async function writeCircleRoles(tx: Tx, circleId: string, drafts: CircleRoleDraft[], memberIds: number[], type: CircleType): Promise<CircleRole[]> {
  const final = assembleCircleRoles(drafts, memberIds, type);
  await tx.delete(circleRoles).where(eq(circleRoles.circleId, circleId));
  await tx.insert(circleRoles).values(final.map((r, position) => ({ id: randomUUID(), circleId, label: r.label, builtin: r.builtin, memberId: r.memberId, position })));
  await syncDelegate(tx, circleId);
  return final;
}

/* A circle started inside another (lib/circles.util.ts's
   circleCanHaveCircles) sends its delegate up, as a full member of that
   circle, so it decides alongside its members. Their membership there is
   kept in step with the Delegate role, here alone: a delegate who isn't a
   member already is made one, marked as there for this circle
   (`delegate_for`), and goes again once they're no longer its delegate, or it
   no longer sits inside a circle, or it's archived. Someone who was a member
   already keeps their own place either way. Called by writeCircleRoles, and
   by leaveCircle, which clears roles itself. */
export async function syncDelegate(tx: Tx, circleId: string): Promise<void> {
  const [circle] = await tx.select({ parentId: circles.parentId, archivedAt: circles.archivedAt }).from(circles).where(eq(circles.id, circleId));
  const [parent] = circle?.parentId ? await tx.select({ id: circles.id, type: circles.type, parentId: circles.parentId }).from(circles).where(eq(circles.id, circle.parentId)) : [];
  const [role] = await tx
    .select({ memberId: circleRoles.memberId })
    .from(circleRoles)
    .where(and(eq(circleRoles.circleId, circleId), eq(circleRoles.builtin, true), eq(circleRoles.label, "Delegate")));
  const up = parent && circleCanHaveCircles(parent) && !circle?.archivedAt ? parent : null;
  const delegate = up ? (role?.memberId ?? null) : null;
  // a place held for this circle by anyone else, or anywhere else
  await tx
    .delete(circleMembers)
    .where(and(eq(circleMembers.delegateFor, circleId), up && delegate !== null ? or(ne(circleMembers.memberId, delegate), ne(circleMembers.circleId, up.id)) : undefined));
  if (up && delegate !== null) {
    await tx.insert(circleMembers).values({ circleId: up.id, circleType: up.type, memberId: delegate, delegateFor: circleId }).onConflictDoNothing();
  }
}
