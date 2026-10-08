import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "./client";
import { UserFacingError } from "./errors";
import { circleInvitations, circleMembers, circles, members } from "./schema";
import type { CircleInvitation } from "@/lib/types";

/* Invitations to join a circle (see circle_invitations in schema.ts). A
   member of a circle invites someone who isn't in it; the invitee accepts
   (and joins) or declines; any member of the circle can delete one. Only the
   invitee and the circle's members ever receive an invitation, so this is
   where that's enforced. Takes the acting member's id and never touches the
   session, like the rest of lib/db. */

export class InvitationError extends UserFacingError {}

type InvitationRow = typeof circleInvitations.$inferSelect;

// the circle's name and tagline travel with the invitation: a group is hidden
// from everyone but its members, so the person invited can't look it up
function toInvitation(row: InvitationRow, circle: { name: string; tagline: string }): CircleInvitation {
  return {
    id: row.id,
    circleId: row.circleId,
    circleName: circle.name,
    circleTagline: circle.tagline,
    memberId: row.memberId,
    ...(row.invitedBy !== null ? { invitedBy: row.invitedBy } : {}),
    createdAt: row.createdAt.toISOString(),
  };
}

async function circleIdsOf(memberId: number): Promise<string[]> {
  const rows = await db.select({ circleId: circleMembers.circleId }).from(circleMembers).where(eq(circleMembers.memberId, memberId));
  return rows.map((r) => r.circleId);
}

// the invitations this member may see: their own, and those of the circles
// they belong to — newest first
export async function getInvitationsForMember(memberId: number): Promise<CircleInvitation[]> {
  const own = await circleIdsOf(memberId);
  const rows = await db
    .select({ invitation: circleInvitations, name: circles.name, tagline: circles.tagline })
    .from(circleInvitations)
    .innerJoin(circles, eq(circles.id, circleInvitations.circleId))
    .where(own.length > 0 ? or(eq(circleInvitations.memberId, memberId), inArray(circleInvitations.circleId, own)) : eq(circleInvitations.memberId, memberId))
    .orderBy(desc(circleInvitations.createdAt));
  return rows.map((r) => toInvitation(r.invitation, r));
}

/* Invite `inviteeId` to `circleId`, as `inviterId`, who must belong to it.
   Not a neighborhood (being a resident is what makes someone a member) or the
   city (everyone's in it already). */
export async function createInvitation(inviterId: number, circleId: string, inviteeId: number): Promise<CircleInvitation> {
  const [circle] = await db.select({ type: circles.type, parentId: circles.parentId, name: circles.name, tagline: circles.tagline }).from(circles).where(eq(circles.id, circleId));
  if (!circle) throw new InvitationError("That circle doesn't exist.");
  if (circle.type === "neighborhood" || circle.parentId === null) throw new InvitationError("Neighborhoods and the city don't take invitations — their members are the people who live there.");
  const roster = (await db.select({ memberId: circleMembers.memberId }).from(circleMembers).where(eq(circleMembers.circleId, circleId))).map((r) => r.memberId);
  if (!roster.includes(inviterId)) throw new InvitationError(`Only members of ${circle.name} can invite people to it.`);
  const [invitee] = await db.select({ name: members.name }).from(members).where(eq(members.id, inviteeId));
  if (!invitee) throw new InvitationError("That person isn't a member of Circles.");
  if (roster.includes(inviteeId)) throw new InvitationError(`${invitee.name} is already a member of ${circle.name}.`);
  const [row] = await db
    .insert(circleInvitations)
    .values({ id: randomUUID(), circleId, memberId: inviteeId, invitedBy: inviterId })
    .onConflictDoNothing()
    .returning();
  if (!row) throw new InvitationError(`${invitee.name} has already been invited to ${circle.name}.`);
  return toInvitation(row, circle);
}

// the invitee accepts: they join the circle, and the invitation is done with
export async function acceptInvitation(memberId: number, id: string): Promise<{ circleId: string }> {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(circleInvitations).where(eq(circleInvitations.id, id)).for("update");
    if (!row || row.memberId !== memberId) throw new InvitationError("That invitation doesn't exist, or isn't yours to accept.");
    const [circle] = await tx.select({ type: circles.type }).from(circles).where(eq(circles.id, row.circleId));
    if (!circle) throw new InvitationError("That circle no longer exists.");
    await tx.insert(circleMembers).values({ circleId: row.circleId, circleType: circle.type, memberId }).onConflictDoNothing();
    await tx.delete(circleInvitations).where(eq(circleInvitations.id, id));
    return { circleId: row.circleId };
  });
}

// deleted by a member of the circle, or declined by the invitee — the same act
export async function deleteInvitation(memberId: number, id: string): Promise<void> {
  const [row] = await db.select().from(circleInvitations).where(eq(circleInvitations.id, id));
  if (!row) throw new InvitationError("That invitation no longer exists.");
  if (row.memberId !== memberId) {
    const [membership] = await db
      .select({ memberId: circleMembers.memberId })
      .from(circleMembers)
      .where(and(eq(circleMembers.circleId, row.circleId), eq(circleMembers.memberId, memberId)));
    if (!membership) throw new InvitationError("Only members of the circle can delete an invitation to it.");
  }
  await db.delete(circleInvitations).where(eq(circleInvitations.id, id));
}

// what the invitee is told, by email (if they have an address and haven't
// turned email off) and by push:
// who they are, who invited them, and to what. Null once it's gone.
export async function getInvitationNoticeData(
  id: string
): Promise<{ memberId: number; email: string | null; phone: string | null; name: string; inviterName?: string; circleName: string; tagline: string } | null> {
  const inviter = alias(members, "inviter");
  const [row] = await db
    .select({ memberId: members.id, email: sql<string | null>`case when ${members.notifyEmail} then ${members.email} end`, phone: sql<string | null>`case when ${members.notifySms} then ${members.phone} end`, name: members.name, inviterName: inviter.name, circleName: circles.name, tagline: circles.tagline })
    .from(circleInvitations)
    .innerJoin(members, eq(members.id, circleInvitations.memberId))
    .innerJoin(circles, eq(circles.id, circleInvitations.circleId))
    .leftJoin(inviter, eq(inviter.id, circleInvitations.invitedBy))
    .where(eq(circleInvitations.id, id));
  if (!row) return null;
  const { inviterName, ...rest } = row;
  return { ...rest, ...(inviterName ? { inviterName } : {}) };
}
