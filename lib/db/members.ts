import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "./client";
import { UserFacingError } from "./errors";
import { circleMembers, memberPhotos, members, phoneVerifications } from "./schema";
import { validateLanguages } from "@/lib/languages.util";
import { PHONE_INVALID, SMS_CONSENT_NOTICE, normalizePhone } from "@/lib/phone.util";
import { isBirthDecade } from "@/lib/members.util";
import type { Member, NotificationSettings, Profile } from "@/lib/types";

export class MemberError extends UserFacingError {}

type MemberRow = typeof members.$inferSelect;

function toMember(row: MemberRow, homeCircleId: string | null, photoUpdatedAt: Date | null): Member {
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
    languages: row.languages,
    ...(row.birthDecade !== null ? { birthDecade: row.birthDecade } : {}),
    email: row.email ?? undefined,
    photoVersion: photoUpdatedAt?.getTime(),
  };
}

// a member's home circle is their (at most one) neighborhood-type membership —
// see circle_members' partial unique index
const homeJoin = and(eq(circleMembers.memberId, members.id), eq(circleMembers.circleType, "neighborhood"));

// only the photo's timestamp — never its bytes, which getMemberPhoto serves
function selectMembers() {
  return db
    .select({ member: members, homeCircleId: circleMembers.circleId, photoUpdatedAt: memberPhotos.updatedAt })
    .from(members)
    .leftJoin(circleMembers, homeJoin)
    .leftJoin(memberPhotos, eq(memberPhotos.memberId, members.id));
}

export async function getMembers(): Promise<Member[]> {
  const rows = await selectMembers();
  return rows.map((r) => toMember(r.member, r.homeCircleId, r.photoUpdatedAt));
}

/* The roster as one member may see it: everyone, but without the email of
   anyone who's hidden theirs — left out here, on the server, so it never
   reaches anyone else's browser at all. Their own always stays. What AppState
   is seeded and refreshed with. */
export async function getMembersForViewer(viewerId: number): Promise<Member[]> {
  const rows = await selectMembers();
  return rows.map((r) => {
    const m = toMember(r.member, r.homeCircleId, r.photoUpdatedAt);
    if (r.member.emailPublic || r.member.id === viewerId) return m;
    const { email: _hidden, ...rest } = m;
    return rest;
  });
}

// the settings only a member themself sees, for their own profile: whether
// others may see their email, and how they're told about things
export async function getOwnSettings(id: number): Promise<Pick<Profile, "emailPublic" | "notifications" | "phone">> {
  const [row] = await db
    .select({ emailPublic: members.emailPublic, email: members.notifyEmail, push: members.notifyPush, phone: members.phone })
    .from(members)
    .where(eq(members.id, id));
  return {
    emailPublic: row?.emailPublic ?? true,
    notifications: { email: row?.email ?? true, push: row?.push ?? true },
    ...(row?.phone ? { phone: row.phone } : {}),
  };
}

/* A member's own mobile number (Settings → Phone number), always their own:
   the actions supply the session's id. A new number is confirmed by a texted
   code before it's theirs: requestPhoneVerification keeps it pending (one at
   a time) with the opt-in shown, and returns the code for the caller to text;
   confirmPhoneVerification moves it onto them, texts on. One member per
   number. */
const PHONE_CODE_MINUTES = 30;
const PHONE_CODE_MAX_ATTEMPTS = 5;
const hashPhoneCode = (code: string) => createHash("sha256").update(code).digest("hex");

export class PhoneError extends UserFacingError {}

export async function requestPhoneVerification(memberId: number, typed: string): Promise<{ phone: string; code: string; minutes: number }> {
  const phone = normalizePhone(typed);
  if (!phone) throw new PhoneError(PHONE_INVALID);
  const [owner] = await db.select({ id: members.id }).from(members).where(eq(members.phone, phone));
  if (owner?.id === memberId) throw new PhoneError("That's already your number.");
  if (owner) throw new PhoneError("That number belongs to another member.");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const row = { phone, codeHash: hashPhoneCode(code), expiresAt: new Date(Date.now() + PHONE_CODE_MINUTES * 60_000), attempts: 0, smsConsent: SMS_CONSENT_NOTICE, createdAt: new Date() };
  await db.insert(phoneVerifications).values({ memberId, ...row }).onConflictDoUpdate({ target: phoneVerifications.memberId, set: row });
  return { phone, code, minutes: PHONE_CODE_MINUTES };
}

export async function confirmPhoneVerification(memberId: number, code: string): Promise<string> {
  return db.transaction(async (tx) => {
    const [pending] = await tx.select().from(phoneVerifications).where(eq(phoneVerifications.memberId, memberId)).for("update");
    if (!pending) throw new PhoneError("Send yourself a code first.");
    if (pending.attempts >= PHONE_CODE_MAX_ATTEMPTS) throw new PhoneError("Too many wrong codes — send yourself a new one.");
    if (pending.expiresAt < new Date()) throw new PhoneError("That code has expired — send yourself a new one.");
    if (!timingSafeEqual(Buffer.from(hashPhoneCode(code.trim())), Buffer.from(pending.codeHash))) {
      await tx.update(phoneVerifications).set({ attempts: pending.attempts + 1 }).where(eq(phoneVerifications.memberId, memberId));
      throw new PhoneError("That code doesn't match — check the text and try again.");
    }
    const [owner] = await tx.select({ id: members.id }).from(members).where(eq(members.phone, pending.phone));
    if (owner && owner.id !== memberId) throw new PhoneError("That number belongs to another member.");
    const now = new Date();
    await tx
      .update(members)
      .set({ phone: pending.phone, phoneVerifiedAt: now, smsConsent: pending.smsConsent, smsConsentAt: now, notifySms: true })
      .where(eq(members.id, memberId));
    await tx.delete(phoneVerifications).where(eq(phoneVerifications.memberId, memberId));
    return pending.phone;
  });
}

// no more texts, and no number kept: removing it withdraws the opt-in too
export async function removePhone(memberId: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(members).set({ phone: null, phoneVerifiedAt: null, smsConsent: null, smsConsentAt: null }).where(eq(members.id, memberId));
    await tx.delete(phoneVerifications).where(eq(phoneVerifications.memberId, memberId));
  });
}

// Settings → Notifications, always the member's own: the action supplies the
// session's id, as updateMember's does
export async function setNotificationSettings(id: number, settings: NotificationSettings): Promise<NotificationSettings> {
  if (typeof settings?.email !== "boolean" || typeof settings?.push !== "boolean") throw new MemberError("Those notification settings weren't recognized.");
  await db.update(members).set({ notifyEmail: settings.email, notifyPush: settings.push }).where(eq(members.id, id));
  return { email: settings.email, push: settings.push };
}

export async function getMemberById(id: number): Promise<Member | null> {
  const [row] = await selectMembers().where(eq(members.id, id));
  return row ? toMember(row.member, row.homeCircleId, row.photoUpdatedAt) : null;
}

export async function getMemberByEmail(email: string): Promise<Member | null> {
  const normalized = email.trim().toLowerCase();
  const [row] = await selectMembers().where(eq(sql`lower(${members.email})`, normalized));
  return row ? toMember(row.member, row.homeCircleId, row.photoUpdatedAt) : null;
}

/* Only the member's own columns are written — a caller may hand this a whole
   Profile (AppStateProvider.saveProfile does), which carries fields that
   aren't columns (homeCircleId, photoVersion). Changing a
   member's home circle is a membership change, not a column edit, and their
   photo goes through setMemberPhoto.

   `id` is always the acting member: lib/db/actions.ts's updateMemberAction
   takes no id from the client at all and supplies the session's own, so
   there's no id to check here — a member can only ever reach their own row.
   Reads (getMemberById) stay open to any id; only the write is narrowed. */
// a profile edit; birthDecade is null to clear it, since an undefined field
// doesn't survive the trip from the browser to a Server Action
export type ProfilePatch = Omit<Partial<Profile>, "birthDecade"> & { birthDecade?: number | null };

export async function updateMember(id: number, patch: ProfilePatch): Promise<Member | null> {
  // never the email itself: it's what they sign in with, and the session finds
  // their member by it (lib/session.ts), so changing it would lock them out
  const { name, lastName, pronouns, role, skills, interests, bio, emailPublic, languages } = patch;
  if (languages !== undefined) {
    const problem = validateLanguages(languages);
    if (problem) throw new MemberError(problem);
  }
  const birthDecade = patch.birthDecade;
  if (birthDecade !== undefined && birthDecade !== null && !isBirthDecade(birthDecade)) throw new MemberError("Pick one of the decades listed.");
  // only the two fields of each, whatever else a request carried
  const columnPatch = { name, lastName, pronouns, role, skills, interests, bio, emailPublic, birthDecade, languages: languages?.map(({ code, level }) => ({ code, level })) };
  if (Object.values(columnPatch).some((v) => v !== undefined)) {
    await db.update(members).set(columnPatch).where(eq(members.id, id));
  }
  return getMemberById(id);
}

export const MAX_PHOTO_BYTES = 1024 * 1024;

// the image type the file's own bytes say it is — its declared type is
// whatever the browser (or a hand-built request) claims
function sniffImageType(bytes: Buffer): string | null {
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

// an uploaded photo's bytes and real type, or the reason it's refused (as the
// caller's own error class) — shared by profile photos and applications'
export async function readPhoto(file: Blob, Refusal: new (message: string) => Error): Promise<{ data: Buffer; contentType: string }> {
  if (file.size === 0) throw new Refusal("Choose a photo to upload.");
  if (file.size > MAX_PHOTO_BYTES) throw new Refusal("That photo is too large — choose one under 1 MB.");
  const data = Buffer.from(await file.arrayBuffer());
  const contentType = sniffImageType(data);
  if (!contentType) throw new Refusal("That file isn't a JPEG, PNG or WebP image.");
  return { data, contentType };
}

/* Replaces the member's photo — there's no removing one (see memberPhotos in
   schema.ts). Like updateMember, `id` is always the acting member. Returns the
   new photoVersion. */
export async function setMemberPhoto(id: number, file: Blob): Promise<number> {
  const { data, contentType } = await readPhoto(file, MemberError);
  const updatedAt = new Date();
  await db
    .insert(memberPhotos)
    .values({ memberId: id, data, contentType, updatedAt })
    .onConflictDoUpdate({ target: memberPhotos.memberId, set: { data, contentType, updatedAt } });
  return updatedAt.getTime();
}

const viewerMembership = alias(circleMembers, "viewer_membership");

/* A member's photo, for a viewer allowed to see it: themself, or someone who
   shares a circle with them — the same rule sharesCircleWith in
   lib/circles.util.ts applies in the UI (components/shared/avatar.tsx), here
   enforced where the bytes are actually served. Null for anyone else, and for
   a member who hasn't uploaded one. */
export async function getMemberPhoto(viewerId: number, memberId: number): Promise<{ data: Buffer; contentType: string } | null> {
  if (viewerId !== memberId) {
    const [shared] = await db
      .select({ circleId: circleMembers.circleId })
      .from(circleMembers)
      .innerJoin(viewerMembership, eq(viewerMembership.circleId, circleMembers.circleId))
      .where(and(eq(circleMembers.memberId, memberId), eq(viewerMembership.memberId, viewerId)))
      .limit(1);
    if (!shared) return null;
  }
  const [row] = await db
    .select({ data: memberPhotos.data, contentType: memberPhotos.contentType })
    .from(memberPhotos)
    .where(eq(memberPhotos.memberId, memberId));
  return row ?? null;
}
