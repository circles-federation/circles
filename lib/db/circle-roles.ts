import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Tx } from "./client";
import { syncDelegate } from "./memberships";
import { circleRoles } from "./schema";
import { assembleCircleRoles, type CircleRoleDraft } from "@/lib/circle-roles.util";
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
