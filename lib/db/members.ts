import { and, eq, sql } from "drizzle-orm";
import { db } from "./client";
import { circleMembers, members } from "./schema";
import type { Member } from "@/lib/types";

type MemberRow = typeof members.$inferSelect;

function toMember(row: MemberRow, homeCircleId: string | null): Member {
  return {
    id: row.id,
    name: row.name,
    lastName: row.lastName ?? undefined,
    pronouns: row.pronouns,
    role: row.role,
    homeCircleId,
    skills: row.skills,
    interests: row.interests,
    bio: row.bio,
    email: row.email ?? undefined,
  };
}

// a member's home circle is their (at most one) neighborhood-type membership —
// see circle_members' partial unique index
const homeJoin = and(eq(circleMembers.memberId, members.id), eq(circleMembers.circleType, "neighborhood"));

export async function getMembers(): Promise<Member[]> {
  const rows = await db.select({ member: members, homeCircleId: circleMembers.circleId }).from(members).leftJoin(circleMembers, homeJoin);
  return rows.map((r) => toMember(r.member, r.homeCircleId));
}

export async function getMemberById(id: number): Promise<Member | null> {
  const [row] = await db
    .select({ member: members, homeCircleId: circleMembers.circleId })
    .from(members)
    .leftJoin(circleMembers, homeJoin)
    .where(eq(members.id, id));
  return row ? toMember(row.member, row.homeCircleId) : null;
}

export async function getMemberByEmail(email: string): Promise<Member | null> {
  const normalized = email.trim().toLowerCase();
  const [row] = await db
    .select({ member: members, homeCircleId: circleMembers.circleId })
    .from(members)
    .leftJoin(circleMembers, homeJoin)
    .where(eq(sql`lower(${members.email})`, normalized));
  return row ? toMember(row.member, row.homeCircleId) : null;
}

/* Only the member's own columns are written — a caller may hand this a whole
   Profile (AppStateProvider.saveProfile does), which carries fields that
   aren't columns (emailPublic, homeCircleId). Changing a member's home circle
   is a membership change, not a column edit.

   `id` is always the acting member: lib/db/actions.ts's updateMemberAction
   takes no id from the client at all and supplies the session's own, so
   there's no id to check here — a member can only ever reach their own row.
   Reads (getMemberById) stay open to any id; only the write is narrowed. */
export async function updateMember(id: number, patch: Partial<Member>): Promise<Member | null> {
  const { name, lastName, pronouns, role, skills, interests, bio, email } = patch;
  const columnPatch = { name, lastName, pronouns, role, skills, interests, bio, email };
  if (Object.values(columnPatch).some((v) => v !== undefined)) {
    await db.update(members).set(columnPatch).where(eq(members.id, id));
  }
  return getMemberById(id);
}
