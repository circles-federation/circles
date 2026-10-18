import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "./client";
import { UserFacingError } from "./errors";
import { countPendingApplications, isAdmin } from "./applications";
import { readPhoto } from "./members";
import { circleMembers, circles, memberPendingPhotos, memberPhotos, members } from "./schema";
import { APPLICATION_NOTE_MAX } from "@/lib/applications.util";

/* A member's new photo goes to a system admin before anyone else sees it,
   as an applicant's does (see member_pending_photos in schema.ts): until it's
   approved their neighbors keep seeing the one they had. The member can
   replace it while it waits. Like the rest of lib/db, every function takes
   the acting member's id and never reads the session itself. */

export class PhotoReviewError extends UserFacingError {}

// which of the two a save made: an admin's own photo goes live at once (there's
// no one above them to ask), anyone else's waits for review
export type PhotoSubmission = { live: number } | { pending: number };

export async function submitMemberPhoto(memberId: number, file: Blob): Promise<PhotoSubmission> {
  const { data, contentType } = await readPhoto(file, PhotoReviewError);
  const now = new Date();
  if (await isAdmin(memberId)) {
    await db.transaction(async (tx) => {
      await tx
        .insert(memberPhotos)
        .values({ memberId, data, contentType, updatedAt: now })
        .onConflictDoUpdate({ target: memberPhotos.memberId, set: { data, contentType, updatedAt: now } });
      await tx.delete(memberPendingPhotos).where(eq(memberPendingPhotos.memberId, memberId));
    });
    return { live: now.getTime() };
  }
  await db
    .insert(memberPendingPhotos)
    .values({ memberId, data, contentType, submittedAt: now })
    .onConflictDoUpdate({ target: memberPendingPhotos.memberId, set: { data, contentType, submittedAt: now } });
  return { pending: now.getTime() };
}

// the photo waiting for review, only to the member themself or an admin
export async function getPendingPhoto(viewerId: number, memberId: number): Promise<{ data: Buffer; contentType: string } | null> {
  if (viewerId !== memberId && !(await isAdmin(viewerId))) return null;
  const [row] = await db
    .select({ data: memberPendingPhotos.data, contentType: memberPendingPhotos.contentType })
    .from(memberPendingPhotos)
    .where(eq(memberPendingPhotos.memberId, memberId));
  return row ?? null;
}

/* The photo a waiting one would replace, for an admin comparing the two (is
   it the same person?): only while one is waiting, so it's no wider a view
   of members' photos than reviewing them needs. */
export async function getCurrentPhotoForReview(adminId: number, memberId: number): Promise<{ data: Buffer; contentType: string } | null> {
  if (!(await isAdmin(adminId))) return null;
  const [row] = await db
    .select({ data: memberPhotos.data, contentType: memberPhotos.contentType })
    .from(memberPhotos)
    .innerJoin(memberPendingPhotos, eq(memberPendingPhotos.memberId, memberPhotos.memberId))
    .where(eq(memberPhotos.memberId, memberId));
  return row ?? null;
}

// for the member's own Profile: when the photo waiting for review was sent
export async function getPendingPhotoVersion(memberId: number): Promise<number | undefined> {
  const [row] = await db.select({ at: memberPendingPhotos.submittedAt }).from(memberPendingPhotos).where(eq(memberPendingPhotos.memberId, memberId));
  return row?.at.getTime();
}

export interface PhotoReview {
  memberId: number;
  name: string;
  lastName?: string;
  neighborhoodName?: string;
  // the photo it would replace, if they have one
  currentVersion?: number;
  // when it was sent, and which version of it the admin is deciding on
  version: number;
}

async function assertAdmin(memberId: number) {
  if (!(await isAdmin(memberId))) throw new PhotoReviewError("Only a system admin can review photos.");
}

function reviews(memberId?: number) {
  return db
    .select({
      memberId: members.id,
      name: members.name,
      lastName: members.lastName,
      neighborhoodName: circles.name,
      currentAt: memberPhotos.updatedAt,
      submittedAt: memberPendingPhotos.submittedAt,
    })
    .from(memberPendingPhotos)
    .innerJoin(members, eq(members.id, memberPendingPhotos.memberId))
    .leftJoin(memberPhotos, eq(memberPhotos.memberId, members.id))
    .leftJoin(circleMembers, and(eq(circleMembers.memberId, members.id), eq(circleMembers.circleType, "neighborhood")))
    .leftJoin(circles, eq(circles.id, circleMembers.circleId))
    .where(memberId === undefined ? undefined : eq(memberPendingPhotos.memberId, memberId))
    .orderBy(asc(memberPendingPhotos.submittedAt));
}

function toReview(r: { memberId: number; name: string; lastName: string | null; neighborhoodName: string | null; currentAt: Date | null; submittedAt: Date }): PhotoReview {
  return {
    memberId: r.memberId,
    name: r.name,
    ...(r.lastName ? { lastName: r.lastName } : {}),
    ...(r.neighborhoodName ? { neighborhoodName: r.neighborhoodName } : {}),
    ...(r.currentAt ? { currentVersion: r.currentAt.getTime() } : {}),
    version: r.submittedAt.getTime(),
  };
}

// what's waiting, oldest first, without the photos themselves
export async function getPhotoReviews(adminId: number): Promise<PhotoReview[]> {
  await assertAdmin(adminId);
  return (await reviews()).map(toReview);
}

export async function getPhotoReview(adminId: number, memberId: number): Promise<PhotoReview | null> {
  await assertAdmin(adminId);
  const [row] = await reviews(memberId);
  return row ? toReview(row) : null;
}

// everything waiting for an admin, applications and photos, for their Home;
// null for anyone else
export async function countPendingReviews(memberId: number): Promise<number | null> {
  const applications = await countPendingApplications(memberId);
  if (applications === null) return null;
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(memberPendingPhotos);
  return applications + (row?.n ?? 0);
}

// who to tell about a decision, and how: their address only while they get email
export interface PhotoDecision {
  memberId: number;
  name: string;
  email?: string;
  note?: string;
}

/* Approving or declining the version the admin looked at: if the member has
   sent another since, it's refused, so no one approves a photo they haven't
   seen. Locked, so two admins can't both decide it. */
async function decide(adminId: number, memberId: number, version: number, approve: boolean, note = ""): Promise<PhotoDecision> {
  await assertAdmin(adminId);
  const trimmed = note.trim();
  if (trimmed.length > APPLICATION_NOTE_MAX) throw new PhotoReviewError(`Keep the note under ${APPLICATION_NOTE_MAX} characters.`);
  return db.transaction(async (tx) => {
    const [pending] = await tx.select().from(memberPendingPhotos).where(eq(memberPendingPhotos.memberId, memberId)).for("update");
    if (!pending) throw new PhotoReviewError("That photo has already been decided.");
    if (pending.submittedAt.getTime() !== version) throw new PhotoReviewError("They've sent a different photo since you opened this one. Reload to review the new one.");
    if (approve) {
      const updatedAt = new Date();
      await tx
        .insert(memberPhotos)
        .values({ memberId, data: pending.data, contentType: pending.contentType, updatedAt })
        .onConflictDoUpdate({ target: memberPhotos.memberId, set: { data: pending.data, contentType: pending.contentType, updatedAt } });
    }
    await tx.delete(memberPendingPhotos).where(eq(memberPendingPhotos.memberId, memberId));
    const [m] = await tx.select({ name: members.name, email: members.email, notifyEmail: members.notifyEmail }).from(members).where(eq(members.id, memberId));
    return {
      memberId,
      name: m?.name ?? "",
      ...(m?.email && m.notifyEmail ? { email: m.email } : {}),
      ...(trimmed ? { note: trimmed } : {}),
    };
  });
}

export async function approvePhoto(adminId: number, memberId: number, version: number): Promise<PhotoDecision> {
  return decide(adminId, memberId, version, true);
}

export async function declinePhoto(adminId: number, memberId: number, version: number, note: string): Promise<PhotoDecision> {
  return decide(adminId, memberId, version, false, note);
}
