import { eq, sql } from "drizzle-orm";
import { db } from "./client";
import { members } from "./schema";
import type { Member } from "@/lib/types";

type MemberRow = typeof members.$inferSelect;

function toMember(row: MemberRow): Member {
  return {
    id: row.id,
    name: row.name,
    lastName: row.lastName ?? undefined,
    pronouns: row.pronouns,
    role: row.role,
    neighborhood: row.neighborhood,
    skills: row.skills,
    interests: row.interests,
    bio: row.bio,
    email: row.email ?? undefined,
  };
}

export async function getMembers(): Promise<Member[]> {
  const rows = await db.select().from(members);
  return rows.map(toMember);
}

export async function getMemberById(id: number): Promise<Member | null> {
  const [row] = await db.select().from(members).where(eq(members.id, id));
  return row ? toMember(row) : null;
}

export async function getMemberByEmail(email: string): Promise<Member | null> {
  const normalized = email.trim().toLowerCase();
  const [row] = await db.select().from(members).where(eq(sql`lower(${members.email})`, normalized));
  return row ? toMember(row) : null;
}

export async function updateMember(id: number, patch: Partial<Member>): Promise<Member | null> {
  const [row] = await db.update(members).set(patch).where(eq(members.id, id)).returning();
  return row ? toMember(row) : null;
}
