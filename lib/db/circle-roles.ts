import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Tx } from "./client";
import { syncDelegate } from "./memberships";
import { circleMembers, circleRoles, circles } from "./schema";
import { assembleCircleRoles, DELEGATE, type CircleRoleDraft } from "@/lib/circle-roles.util";
import type { CircleRole, CircleType } from "@/lib/types";

const parentOf = alias(circles, "parent_circle");

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
   started inside, or in a federation, follows (syncDelegate). A circle in a
   federation has a Delegate whatever its type, which only its parent says, so
   that's read here rather than trusted to every caller. */
export async function writeCircleRoles(tx: Tx, circleId: string, drafts: CircleRoleDraft[], memberIds: number[], type: CircleType): Promise<CircleRole[]> {
  const [parent] = await tx.select({ type: parentOf.type }).from(circles).innerJoin(parentOf, eq(parentOf.id, circles.parentId)).where(eq(circles.id, circleId));
  const final = assembleCircleRoles(drafts, memberIds, type, parent?.type === "federation");
  await tx.delete(circleRoles).where(eq(circleRoles.circleId, circleId));
  await tx.insert(circleRoles).values(final.map((r, position) => ({ id: randomUUID(), circleId, label: r.label, builtin: r.builtin, memberId: r.memberId, position })));
  await syncDelegate(tx, circleId);
  return final;
}

/* Make `memberId` a circle's delegate, keeping every other role as it is: how
   a circle that joins a federation sends someone up. They must be one of its
   members. */
export async function setDelegate(tx: Tx, circleId: string, memberId: number): Promise<void> {
  const [circle] = await tx.select({ type: circles.type }).from(circles).where(eq(circles.id, circleId));
  if (!circle) return;
  const kept = await tx.select({ label: circleRoles.label, memberId: circleRoles.memberId }).from(circleRoles).where(eq(circleRoles.circleId, circleId)).orderBy(asc(circleRoles.position));
  const memberIds = (await tx.select({ id: circleMembers.memberId }).from(circleMembers).where(eq(circleMembers.circleId, circleId))).map((r) => r.id);
  const drafts: CircleRoleDraft[] = [...kept.filter((r) => r.label !== DELEGATE), { label: DELEGATE, memberId }];
  await writeCircleRoles(tx, circleId, drafts, memberIds, circle.type);
}
