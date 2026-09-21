import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./client";
import { UserFacingError } from "./errors";
import { circleMembers, circleRoles, circles } from "./schema";
import { assembleCircleRoles, circleHasRoles, validateCircleRoles, type CircleRoleDraft } from "@/lib/circle-roles.util";
import type { CircleRole } from "@/lib/types";

export class CircleRoleError extends UserFacingError {}

/* Replace a circle's roles — the one write path for them. Circles are public
   (every signed-in member is sent all of them, roles included), so reading
   needs no check; changing them is for the circle's own members. Takes the
   acting member's id and never touches the session, so it can be exercised
   directly (lib/db/actions.ts supplies the session's).

   The client sends what it wants — each role's name and holder, in order —
   and the server decides the rest: the built-in roles are always kept (a
   missing one is just empty; they can't be removed or renamed), everything
   else is the circle's own, and holders must belong to the circle. Returns the
   roles as saved. */
export async function setCircleRoles(memberId: number, circleId: string, drafts: CircleRoleDraft[]): Promise<CircleRole[]> {
  const [circle] = await db.select().from(circles).where(eq(circles.id, circleId));
  if (!circle) throw new CircleRoleError("That circle doesn't exist.");
  if (!circleHasRoles(circle)) throw new CircleRoleError("Neighborhoods and the city don't have roles.");
  const memberIds = (await db.select({ id: circleMembers.memberId }).from(circleMembers).where(eq(circleMembers.circleId, circleId))).map((m) => m.id);
  if (!memberIds.includes(memberId)) throw new CircleRoleError(`Only members of ${circle.name} can change its roles.`);
  const problem = validateCircleRoles(drafts, memberIds);
  if (problem) throw new CircleRoleError(problem);

  const final = assembleCircleRoles(drafts, memberIds);
  await db.transaction(async (tx) => {
    await tx.delete(circleRoles).where(eq(circleRoles.circleId, circleId));
    await tx.insert(circleRoles).values(final.map((r, position) => ({ id: randomUUID(), circleId, label: r.label, builtin: r.builtin, memberId: r.memberId, position })));
  });
  return final;
}
