import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Tx } from "./client";
import { unassignMessagesFromCircle } from "./messages";
import { circleInvitations, circleMembers, circleRoles, circles } from "./schema";
import { unassignFromCircle } from "./tasks";
import { DELEGATE } from "@/lib/circle-roles.util";
import { circleCanHaveCircles } from "@/lib/circles.util";

const children = alias(circles, "children");

/* Take `memberId` out of `circleId` and everything that came with being in
   it: the roles they held there are left empty, its tasks and messages they
   were handling are let go, and if they were its last member it's archived
   and its invitations go. Whether they may go is the caller's to decide:
   leaving (leaveCircle) or no longer being one of its circles' delegate
   (syncDelegate). Returns whether it was archived. */
export async function dropMembership(tx: Tx, memberId: number, circleId: string): Promise<{ archived: boolean }> {
  await tx.delete(circleMembers).where(and(eq(circleMembers.circleId, circleId), eq(circleMembers.memberId, memberId)));
  await tx.update(circleRoles).set({ memberId: null }).where(and(eq(circleRoles.circleId, circleId), eq(circleRoles.memberId, memberId)));
  await unassignFromCircle(tx, memberId, circleId);
  await unassignMessagesFromCircle(tx, memberId, circleId);
  const [remaining] = await tx.select({ id: circleMembers.memberId }).from(circleMembers).where(eq(circleMembers.circleId, circleId)).limit(1);
  if (!remaining) {
    await tx.update(circles).set({ archivedAt: new Date() }).where(eq(circles.id, circleId));
    await tx.delete(circleInvitations).where(eq(circleInvitations.circleId, circleId));
  }
  // a role of theirs here may have been its Delegate, and an archived circle
  // sends no one up
  await syncDelegate(tx, circleId);
  return { archived: !remaining };
}

/* A circle started inside another (lib/circles.util.ts's
   circleCanHaveCircles) sends its delegate up, as a full member of that
   circle, so it decides alongside its members. Their membership there is
   kept in step with the Delegate roles here alone: a delegate who isn't a
   member already is made one, marked as there for a circle they speak for
   (`delegate_for`), and goes again (dropMembership) once they speak for none
   of its circles. Someone who was a member already keeps their own place
   either way. Called whenever what `circleId` sends up may have changed: its
   roles (writeCircleRoles), its parent or type, a member leaving it, its
   archiving. Settles the circle it's in now and any it had a delegate in
   before. */
export async function syncDelegate(tx: Tx, circleId: string): Promise<void> {
  const [circle] = await tx.select({ parentId: circles.parentId }).from(circles).where(eq(circles.id, circleId));
  const before = await tx.selectDistinct({ id: circleMembers.circleId }).from(circleMembers).where(eq(circleMembers.delegateFor, circleId));
  const parents = new Set([...(circle?.parentId ? [circle.parentId] : []), ...before.map((r) => r.id)]);
  for (const parentId of parents) await settleDelegates(tx, parentId);
}

// every delegate's place in `parentId`, matched to who its circles'
// delegates are now: one person may speak for several of them
async function settleDelegates(tx: Tx, parentId: string): Promise<void> {
  const [parent] = await tx.select().from(circles).where(eq(circles.id, parentId)).for("update");
  if (!parent) return;
  const delegates = new Map<number, string[]>();
  if (circleCanHaveCircles(parent) && !parent.archivedAt) {
    const held = await tx
      .select({ memberId: circleRoles.memberId, childId: children.id })
      .from(circleRoles)
      .innerJoin(children, eq(children.id, circleRoles.circleId))
      .where(and(eq(children.parentId, parentId), isNull(children.archivedAt), eq(circleRoles.builtin, true), eq(circleRoles.label, DELEGATE), isNotNull(circleRoles.memberId)));
    for (const { memberId, childId } of held) delegates.set(memberId!, [...(delegates.get(memberId!) ?? []), childId]);
  }
  const seats = await tx
    .select({ memberId: circleMembers.memberId, delegateFor: circleMembers.delegateFor })
    .from(circleMembers)
    .where(and(eq(circleMembers.circleId, parentId), isNotNull(circleMembers.delegateFor)));
  for (const seat of seats) {
    const speaksFor = delegates.get(seat.memberId);
    if (!speaksFor) await dropMembership(tx, seat.memberId, parentId);
    // still a delegate, but for another of its circles than the one marked
    else if (!speaksFor.includes(seat.delegateFor!)) {
      await tx.update(circleMembers).set({ delegateFor: speaksFor[0]! }).where(and(eq(circleMembers.circleId, parentId), eq(circleMembers.memberId, seat.memberId)));
    }
  }
  const seated = new Set(seats.map((s) => s.memberId));
  const toSeat = [...delegates].filter(([memberId]) => !seated.has(memberId));
  // a member already here in their own right keeps that place (the conflict)
  if (toSeat.length > 0) {
    await tx
      .insert(circleMembers)
      .values(toSeat.map(([memberId, speaksFor]) => ({ circleId: parentId, circleType: parent.type, memberId, delegateFor: speaksFor[0]! })))
      .onConflictDoNothing();
  }
}
