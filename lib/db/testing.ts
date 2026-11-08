import { sql } from "drizzle-orm";
import { db } from "./client";
import { circleMembers, circleRoles, circles, members } from "./schema";
import { writeCircleRoles } from "./circle-roles";
import type { CircleRoleDraft } from "@/lib/circle-roles.util";
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
  // explicit ids don't move the identity sequence, as the seed scripts know
  await db.execute(sql`select setval(pg_get_serial_sequence('members', 'id'), (select max(id) from members))`);
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

// replace a circle's roles as a passed Roles proposal would; holders must be members
export async function setRoles(circleId: string, drafts: CircleRoleDraft[]): Promise<void> {
  const [circle] = await db.select({ type: circles.type }).from(circles).where(sql`${circles.id} = ${circleId}`);
  if (!circle) throw new Error(`No circle ${circleId}`);
  const ids = (await db.select({ id: circleMembers.memberId }).from(circleMembers).where(sql`${circleMembers.circleId} = ${circleId}`)).map((r) => r.id);
  await db.transaction((tx) => writeCircleRoles(tx, circleId, drafts, ids, circle.type));
}

// a member's place in a circle: undefined if none, null if in their own right,
// else the circle they sit there as delegate for
export async function seatIn(circleId: string, memberId: number): Promise<string | null | undefined> {
  const { rows } = await db.execute<{ delegate_for: string | null }>(
    sql`select delegate_for from circle_members where circle_id = ${circleId} and member_id = ${memberId}`
  );
  return rows[0] === undefined ? undefined : rows[0].delegate_for;
}

export async function roleHolder(circleId: string, label: string): Promise<number | null | undefined> {
  const { rows } = await db.execute<{ member_id: number | null }>(
    sql`select member_id from circle_roles where circle_id = ${circleId} and label = ${label}`
  );
  return rows[0] === undefined ? undefined : rows[0].member_id;
}

export async function enablePush(memberId: number): Promise<void> {
  await db.execute(sql`insert into push_subscriptions (endpoint, member_id, p256dh, auth) values (${`https://push.example.test/${memberId}`}, ${memberId}, 'k', 'a')`);
}

export async function setNotify(memberId: number, over: { email?: boolean; push?: boolean; address?: string | null }): Promise<void> {
  if (over.email !== undefined) await db.execute(sql`update members set notify_email = ${over.email} where id = ${memberId}`);
  if (over.push !== undefined) await db.execute(sql`update members set notify_push = ${over.push} where id = ${memberId}`);
  if (over.address !== undefined) await db.execute(sql`update members set email = ${over.address} where id = ${memberId}`);
}

// the queue rows about an event for a member and kind: channel, digest, and delivery state
export async function noticeRows(eventId: string, memberId: number, kind: string) {
  const { rows } = await db.execute<{ channel: string; digest: boolean; sent_at: Date | null; attempts: number; change: unknown }>(
    sql`select channel, digest, sent_at, attempts, change from event_notifications where event_id = ${eventId} and member_id = ${memberId} and kind = ${kind} order by channel`
  );
  return rows;
}

// every (kind, member, channel, digest) queued about an event, for asserting on the whole queue
export async function queueOf(eventId: string): Promise<string[]> {
  const { rows } = await db.execute<{ kind: string; member_id: number; channel: string; digest: boolean }>(
    sql`select kind, member_id, channel, digest from event_notifications where event_id = ${eventId} order by kind, member_id, channel`
  );
  return rows.map((r) => `${r.kind}:${r.member_id}:${r.channel}${r.digest ? ":digest" : ""}`);
}

export async function ageNotice(eventId: string, memberId: number, kind: string, set: { lastAttemptMinutesAgo?: number; attempts?: number }): Promise<void> {
  if (set.lastAttemptMinutesAgo !== undefined)
    await db.execute(sql`update event_notifications set last_attempt_at = now() - make_interval(mins => ${set.lastAttemptMinutesAgo}) where event_id = ${eventId} and member_id = ${memberId} and kind = ${kind}`);
  if (set.attempts !== undefined)
    await db.execute(sql`update event_notifications set attempts = ${set.attempts} where event_id = ${eventId} and member_id = ${memberId} and kind = ${kind}`);
}

export async function setInbox(circleId: string, on = true): Promise<void> {
  await db.execute(sql`update circles set inbox_enabled = ${on} where id = ${circleId}`);
}

// a guest's RSVP as stored, by id
export async function guestRsvpRow(id: string) {
  const { rows } = await db.execute<{ confirmed: boolean; attempts: number; name: string; waiting_on_code: boolean; emails_off: boolean }>(
    sql`select confirmed_at is not null as confirmed, code_attempts as attempts, name, code_hash is not null as waiting_on_code, emails_off_at is not null as emails_off from event_guest_rsvps where id = ${id}`
  );
  return rows[0];
}

export async function guestRsvpCount(): Promise<number> {
  const { rows } = await db.execute<{ n: number }>(sql`select count(*)::int as n from event_guest_rsvps`);
  return rows[0]!.n;
}

export async function guestNoticeKinds(guestId: string): Promise<string[]> {
  const { rows } = await db.execute<{ kind: string }>(sql`select kind from guest_notifications where guest_id = ${guestId} order by kind`);
  return rows.map((r) => r.kind);
}

// make a waiting code expired, or old enough to be asked for again
export async function ageGuestCode(table: "event_guest_rsvps" | "guest_message_drafts", id: string, what: "expired" | "cooldown-over"): Promise<void> {
  const t = sql.identifier(table);
  if (what === "expired") await db.execute(sql`update ${t} set code_expires_at = now() - interval '1 minute' where id = ${id}`);
  else await db.execute(sql`update ${t} set code_sent_at = now() - interval '2 minutes' where id = ${id}`);
}

export async function backdate(table: "event_guest_rsvps" | "guest_message_drafts", id: string, daysAgo: number): Promise<void> {
  await db.execute(sql`update ${sql.identifier(table)} set created_at = now() - make_interval(days => ${daysAgo}) where id = ${id}`);
}

export async function guestMessageDraftCount(): Promise<number> {
  const { rows } = await db.execute<{ n: number }>(sql`select count(*)::int as n from guest_message_drafts`);
  return rows[0]!.n;
}

export async function codeRequestCount(): Promise<number> {
  const { rows } = await db.execute<{ n: number }>(sql`select count(*)::int as n from guest_code_requests`);
  return rows[0]!.n;
}

export async function loginExists(email: string): Promise<boolean> {
  const { rows } = await db.execute<{ n: number }>(sql`select count(*)::int as n from "user" where email = ${email}`);
  return rows[0]!.n > 0;
}

export async function applicationRow(id: string) {
  const { rows } = await db.execute<{ status: string; has_photo: boolean; attempts: number; code_pending: boolean; referred_by: number | null; member_id: number | null; note: string | null }>(
    sql`select status, photo is not null as has_photo, confirm_attempts as attempts, confirm_code_hash is not null as code_pending, referred_by, member_id, note from applications where id = ${id}`
  );
  return rows[0];
}

export async function ageApplicationCode(id: string, what: "expired" | "created-two-days-ago"): Promise<void> {
  if (what === "expired") await db.execute(sql`update applications set confirm_expires_at = now() - interval '1 minute' where id = ${id}`);
  else await db.execute(sql`update applications set created_at = now() - interval '2 days' where id = ${id}`);
}

export async function addGuestRsvp(eventId: string, invitedBy: number, email: string): Promise<void> {
  await db.execute(sql`insert into event_guest_rsvps (id, event_id, invited_by, name, email, confirmed_at) values (gen_random_uuid(), ${eventId}, ${invitedBy}, 'Ona', ${email}, now())`);
}

export async function setMemberEmail(memberId: number, email: string): Promise<void> {
  await db.execute(sql`update members set email = ${email} where id = ${memberId}`);
}

// a share link made without the checks getOrCreateShareToken applies, to test what the public page still refuses
export async function addShareLink(token: string, eventId: string, memberId: number): Promise<void> {
  await db.execute(sql`insert into event_share_links (token, event_id, member_id) values (${token}, ${eventId}, ${memberId})`);
}

// how many rows every table holds, to assert that something wrote nothing
export async function tableCounts(): Promise<Record<string, number>> {
  const { rows } = await db.execute<{ tablename: string }>(sql`select tablename from pg_tables where schemaname = 'public' order by tablename`);
  const counts: Record<string, number> = {};
  for (const { tablename } of rows) {
    const { rows: n } = await db.execute<{ n: number }>(sql.raw(`select count(*)::int as n from "${tablename}"`));
    counts[tablename] = n[0]!.n;
  }
  return counts;
}

export async function memberName(id: number): Promise<string | undefined> {
  const { rows } = await db.execute<{ name: string }>(sql`select name from members where id = ${id}`);
  return rows[0]?.name;
}

export async function circleArchived(id: string): Promise<boolean> {
  const { rows } = await db.execute<{ archived: boolean }>(sql`select archived_at is not null as archived from circles where id = ${id}`);
  return rows[0]?.archived ?? false;
}

export async function circleEditor(id: string): Promise<{ by: number | null; at: Date | null }> {
  const { rows } = await db.execute<{ by: number | null; at: string | null }>(sql`select last_edited_by as by, last_edited_at as at from circles where id = ${id}`);
  return { by: rows[0]?.by ?? null, at: rows[0]?.at ? new Date(rows[0].at) : null };
}
