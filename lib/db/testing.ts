import { sql } from "drizzle-orm";
import { db } from "./client";
import { circleMembers, circleRoles, circles, members } from "./schema";
import type { Circle } from "@/lib/types";

/* Helpers for the *.db.test.ts files, which run against the throwaway
   database lib/test/db-global-setup.ts builds. Lives here because only
   lib/db/ may import the schema. */

export async function resetDb(): Promise<void> {
  const { rows } = await db.execute<{ tablename: string }>(sql`select tablename from pg_tables where schemaname = 'public'`);
  if (rows.length === 0) return;
  const names = rows.map((r) => `"${r.tablename}"`).join(", ");
  await db.execute(sql.raw(`TRUNCATE ${names} RESTART IDENTITY CASCADE`));
}

export async function addMember(id: number, name = `Member ${id}`): Promise<number> {
  await db.insert(members).values({ id, name, pronouns: "", role: "", bio: "", email: `m${id}@example.test` });
  return id;
}

export async function addCircle(id: string, over: Partial<Pick<Circle, "type" | "parentId" | "name">> = {}): Promise<string> {
  await db.insert(circles).values({
    id,
    type: over.type ?? "circle",
    name: over.name ?? id,
    parentId: over.parentId ?? null,
    tagline: "",
    about: "",
  });
  return id;
}

export async function join(circleId: string, ...memberIds: number[]): Promise<void> {
  const [circle] = await db.select({ type: circles.type }).from(circles).where(sql`${circles.id} = ${circleId}`);
  if (!circle) throw new Error(`No circle ${circleId}`);
  await db.insert(circleMembers).values(memberIds.map((memberId) => ({ circleId, circleType: circle.type, memberId })));
}

// who's been queued a notice of this kind about a proposal, whatever the channel
export async function proposalNotices(proposalId: string, kind: string): Promise<number[]> {
  const { rows } = await db.execute<{ member_id: number }>(
    sql`select distinct member_id from proposal_notifications where proposal_id = ${proposalId} and kind = ${kind} order by member_id`
  );
  return rows.map((r) => r.member_id);
}

export async function giveRole(circleId: string, label: string, memberId: number): Promise<void> {
  await db.insert(circleRoles).values({ id: `${circleId}-${label}`, circleId, label, builtin: true, memberId, position: 0 });
}

// who's been queued a notice of this kind about an event, whatever the channel
export async function eventNotices(eventId: string, kind: string): Promise<number[]> {
  const { rows } = await db.execute<{ member_id: number }>(
    sql`select distinct member_id from event_notifications where event_id = ${eventId} and kind = ${kind} order by member_id`
  );
  return rows.map((r) => r.member_id);
}
