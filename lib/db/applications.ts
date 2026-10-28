import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { and, asc, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, type Tx } from "./client";
import { UserFacingError } from "./errors";
import { readPhoto } from "./members";
import { applications, circleMembers, circles, eventGuestRsvps, eventRsvps, events, memberPhotos, members, user } from "./schema";
import { hasEnded } from "@/lib/events.util";
import type { CirclePlace } from "@/lib/types";
import { APPLICATION_NOTE_MAX, BETA_AGREEMENT_VERSION, validateApplication, type ApplicationInput } from "@/lib/applications.util";

/* Applications to join (see the applications table in schema.ts). The public
   half — starting one and confirming its email — takes no member at all, since
   the applicant isn't one yet; the review half takes the acting member's id
   and requires them to be a system admin. Like the rest of lib/db, it never
   reads the session itself: lib/apply.ts and lib/db/actions.ts supply who's
   asking. */

export class ApplicationError extends UserFacingError {}

// how long an emailed confirmation code works, and how many wrong tries it takes
export const CONFIRM_CODE_MINUTES = 30;
const CONFIRM_MAX_ATTEMPTS = 5;
// an application never confirmed is dropped after this long, so an abandoned
// one doesn't hold its address forever
const UNCONFIRMED_TTL_MS = 24 * 60 * 60 * 1000;

const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");
const normalizeEmail = (email: string) => email.trim().toLowerCase();

/* The neighborhoods someone can apply to live in, for the apply form's
   Federation Explorer, with the city they sit in: where each is and what it
   is, never who's in it, since the form is public */
export async function getNeighborhoodsForApplying(): Promise<CirclePlace[]> {
  return db
    .select({ id: circles.id, name: circles.name, type: circles.type, parentId: circles.parentId })
    .from(circles)
    .where(and(or(eq(circles.type, "neighborhood"), isNull(circles.parentId)), isNull(circles.archivedAt)))
    .orderBy(asc(circles.name));
}

/* Start an application: checked, stored unconfirmed, and given a confirmation
   code for the caller to email. Starting again with the same address replaces
   an unconfirmed one (a typo, a lost email), but not one already waiting for
   review. `agreementVersion` is the version of the beta terms and privacy
   notes the applicant agreed to, which must be the current one. Returns the
   new application's id and its code.

   A guest who RSVPed from an event's share link (`guest`) has already proved
   their address with a code, so their application goes straight to review,
   with no code of its own (its `code` is null), and remembers who invited
   them. The address must be the one they RSVPed with. */
export interface VerifiedGuest {
  email: string;
  eventId: string;
  invitedBy: number | null;
}

export async function startApplication(input: ApplicationInput, photo: Blob, agreementVersion: string, guest?: VerifiedGuest): Promise<{ id: string; code: string | null }> {
  const problems = validateApplication(input, photo.size > 0);
  const first = Object.values(problems)[0];
  if (first) throw new ApplicationError(first);
  if (!agreementVersion) throw new ApplicationError("Agree to the beta terms and privacy notes to apply.");
  if (agreementVersion !== BETA_AGREEMENT_VERSION) throw new ApplicationError("The beta terms have changed since you opened this page. Reload it to read them.");
  const { data, contentType } = await readPhoto(photo, ApplicationError);
  const email = normalizeEmail(input.email);
  const [hood] = await db.select({ id: circles.id }).from(circles).where(and(eq(circles.id, input.neighborhoodId), eq(circles.type, "neighborhood")));
  if (!hood) throw new ApplicationError("Choose one of the neighborhoods listed.");
  const [member] = await db.select({ id: members.id }).from(members).where(sql`lower(${members.email}) = ${email}`);
  if (member) throw new ApplicationError("That email already belongs to a member — sign in instead.");

  if (guest && normalizeEmail(guest.email) !== email) throw new ApplicationError("Use the email address you RSVPed with.");
  const id = randomUUID();
  const code = guest ? null : String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.transaction(async (tx) => {
    await tx.delete(applications).where(and(eq(applications.status, "unconfirmed"), lt(applications.createdAt, new Date(Date.now() - UNCONFIRMED_TTL_MS))));
    await tx.delete(applications).where(and(eq(applications.status, "unconfirmed"), sql`lower(${applications.email}) = ${email}`));
    const [open] = await tx.select({ id: applications.id }).from(applications).where(and(eq(applications.status, "pending"), sql`lower(${applications.email}) = ${email}`));
    if (open) throw new ApplicationError("There's already an application for this email waiting to be reviewed. We'll email you once it's decided.");
    await tx.insert(applications).values({
      id,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email,
      neighborhoodId: hood.id,
      photo: data,
      photoType: contentType,
      agreementVersion,
      agreedAt: new Date(),
      ...(code !== null
        ? { confirmCodeHash: hashCode(code), confirmExpiresAt: new Date(Date.now() + CONFIRM_CODE_MINUTES * 60_000) }
        : { status: "pending" as const, submittedAt: new Date(), referredBy: guest?.invitedBy ?? null, referredEventId: guest?.eventId ?? null }),
    });
  });
  return { id, code };
}

// the address of an application still waiting to be confirmed
export async function unconfirmedApplicationEmail(id: string): Promise<string> {
  const [row] = await db.select({ email: applications.email, status: applications.status }).from(applications).where(eq(applications.id, id));
  if (!row || row.status !== "unconfirmed") throw new ApplicationError("That application has already been confirmed, or has expired — start again.");
  return row.email;
}

/* A fresh code for an application still waiting to be confirmed — when the
   first email didn't arrive. Returns the address to send it to. */
export async function renewConfirmationCode(id: string): Promise<{ email: string; code: string }> {
  const email = await unconfirmedApplicationEmail(id);
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db
    .update(applications)
    .set({ confirmCodeHash: hashCode(code), confirmExpiresAt: new Date(Date.now() + CONFIRM_CODE_MINUTES * 60_000), confirmAttempts: 0 })
    .where(eq(applications.id, id));
  return { email, code };
}

// the emailed code proves the address is theirs, and sends the application on
// to the admins
export async function confirmApplication(id: string, code: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(applications).where(eq(applications.id, id)).for("update");
    if (!row || row.status !== "unconfirmed" || !row.confirmCodeHash) throw new ApplicationError("That application has already been confirmed, or has expired — start again.");
    if (row.confirmAttempts >= CONFIRM_MAX_ATTEMPTS) throw new ApplicationError("Too many wrong codes — send yourself a new one.");
    if (!row.confirmExpiresAt || row.confirmExpiresAt < new Date()) throw new ApplicationError("That code has expired — send yourself a new one.");
    const given = Buffer.from(hashCode(code.trim()));
    if (!timingSafeEqual(given, Buffer.from(row.confirmCodeHash))) {
      await tx.update(applications).set({ confirmAttempts: row.confirmAttempts + 1 }).where(eq(applications.id, id));
      throw new ApplicationError("That code doesn't match — check the email and try again.");
    }
    await tx
      .update(applications)
      .set({ status: "pending", submittedAt: new Date(), confirmCodeHash: null, confirmExpiresAt: null })
      .where(eq(applications.id, id));
  });
}

export async function isAdmin(memberId: number): Promise<boolean> {
  const [row] = await db.select({ isAdmin: members.isAdmin }).from(members).where(eq(members.id, memberId));
  return !!row?.isAdmin;
}

async function assertAdmin(memberId: number) {
  if (!(await isAdmin(memberId))) throw new ApplicationError("Only a system admin can review applications.");
}

export interface PendingApplication {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  neighborhoodId: string;
  neighborhoodName: string;
  submittedAt: string;
  // came from an event's share link: who shared it, and which event
  invitedBy?: string;
  invitedVia?: string;
}

const inviter = alias(members, "inviter");

const pendingColumns = {
  id: applications.id,
  firstName: applications.firstName,
  lastName: applications.lastName,
  email: applications.email,
  neighborhoodId: applications.neighborhoodId,
  neighborhoodName: circles.name,
  submittedAt: applications.submittedAt,
  invitedBy: inviter.name,
  invitedVia: events.title,
};

function toPending({ invitedBy, invitedVia, submittedAt, ...r }: { id: string; firstName: string; lastName: string; email: string; neighborhoodId: string; neighborhoodName: string; submittedAt: Date | null; invitedBy: string | null; invitedVia: string | null }): PendingApplication {
  return { ...r, submittedAt: (submittedAt ?? new Date()).toISOString(), ...(invitedBy ? { invitedBy } : {}), ...(invitedVia ? { invitedVia } : {}) };
}

// what's waiting for review, oldest first — without the photos, which the
// admin-only photo route serves one at a time
export async function getPendingApplications(adminId: number): Promise<PendingApplication[]> {
  await assertAdmin(adminId);
  const rows = await db
    .select(pendingColumns)
    .from(applications)
    .innerJoin(circles, eq(circles.id, applications.neighborhoodId))
    .leftJoin(inviter, eq(inviter.id, applications.referredBy))
    .leftJoin(events, eq(events.id, applications.referredEventId))
    .where(eq(applications.status, "pending"))
    .orderBy(asc(applications.submittedAt));
  return rows.map(toPending);
}

// how many are waiting, for an admin's Home; null for anyone else
export async function countPendingApplications(memberId: number): Promise<number | null> {
  if (!(await isAdmin(memberId))) return null;
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(applications).where(eq(applications.status, "pending"));
  return row?.n ?? 0;
}

export async function getPendingApplication(adminId: number, id: string): Promise<PendingApplication | null> {
  await assertAdmin(adminId);
  const [row] = await db
    .select(pendingColumns)
    .from(applications)
    .innerJoin(circles, eq(circles.id, applications.neighborhoodId))
    .leftJoin(inviter, eq(inviter.id, applications.referredBy))
    .leftJoin(events, eq(events.id, applications.referredEventId))
    .where(and(eq(applications.id, id), eq(applications.status, "pending")));
  return row ? toPending(row) : null;
}

// an application's photo, for an admin only — it's someone who isn't a member yet
export async function getApplicationPhoto(adminId: number, id: string): Promise<{ data: Buffer; contentType: string } | null> {
  if (!(await isAdmin(adminId))) return null;
  const [row] = await db.select({ data: applications.photo, contentType: applications.photoType }).from(applications).where(eq(applications.id, id));
  return row?.data && row.contentType ? { data: row.data, contentType: row.contentType } : null;
}

export interface Decision {
  email: string;
  firstName: string;
  neighborhoodName: string;
  note?: string;
}

/* A new member's RSVPs from before they had an account (lib/db/guest-rsvps.ts)
   become real ones, for the events they can now see: a live, upcoming event
   shown to the whole city or to their neighborhood, the one circle they start
   in. Any other stays a guest RSVP, which still works from its share link. */
async function adoptGuestRsvps(tx: Tx, email: string, memberId: number, neighborhoodId: string): Promise<void> {
  const [root] = await tx.select({ id: circles.id }).from(circles).where(isNull(circles.parentId));
  const guests = await tx
    .select({ id: eventGuestRsvps.id, eventId: events.id, circleId: events.circleId, date: events.date, start: events.start, end: events.end, approvedAt: events.approvedAt, cancelledAt: events.cancelledAt })
    .from(eventGuestRsvps)
    .innerJoin(events, eq(events.id, eventGuestRsvps.eventId))
    .where(and(sql`lower(${eventGuestRsvps.email}) = ${email}`, isNotNull(eventGuestRsvps.confirmedAt)));
  const adopt = guests.filter(
    (g) =>
      g.approvedAt !== null &&
      g.cancelledAt === null &&
      !hasEnded({ date: g.date, start: g.start.slice(0, 5), end: g.end.slice(0, 5) }) &&
      (g.circleId === neighborhoodId || g.circleId === root?.id)
  );
  if (adopt.length === 0) return;
  await tx.insert(eventRsvps).values(adopt.map((g) => ({ eventId: g.eventId, memberId }))).onConflictDoNothing();
  await tx.delete(eventGuestRsvps).where(inArray(eventGuestRsvps.id, adopt.map((g) => g.id)));
}

/* Approve: the applicant becomes a member of their neighborhood, with their
   photo and a login for their email, all in one transaction — and the
   application keeps only who decided and who it became, not the address or
   the photo. Returns what the approval email needs. */
export async function approveApplication(adminId: number, id: string): Promise<Decision> {
  await assertAdmin(adminId);
  return db.transaction(async (tx) => {
    const [app] = await tx.select().from(applications).where(eq(applications.id, id)).for("update");
    if (!app || app.status !== "pending") throw new ApplicationError("That application has already been decided.");
    const [taken] = await tx.select({ id: members.id }).from(members).where(sql`lower(${members.email}) = ${app.email}`);
    if (taken) throw new ApplicationError("That email already belongs to a member, so this application can only be declined.");
    const [hood] = await tx.select({ id: circles.id, name: circles.name }).from(circles).where(eq(circles.id, app.neighborhoodId));
    if (!hood) throw new ApplicationError("That neighborhood no longer exists.");

    const [member] = await tx
      .insert(members)
      .values({ name: app.firstName, lastName: app.lastName, pronouns: "", role: "", bio: "", email: app.email })
      .returning({ id: members.id });
    if (!member) throw new ApplicationError("Couldn't create the member — try again.");
    if (app.photo && app.photoType) await tx.insert(memberPhotos).values({ memberId: member.id, data: app.photo, contentType: app.photoType });
    await tx.insert(circleMembers).values({ circleId: hood.id, circleType: "neighborhood", memberId: member.id });
    // their login: sign-up is off (lib/better-auth.ts), so this row is what
    // lets the email sign in — as the seed scripts create them
    await tx
      .insert(user)
      .values({ id: `user_${member.id}`, name: `${app.firstName} ${app.lastName}`, email: app.email, emailVerified: true })
      .onConflictDoNothing();
    await adoptGuestRsvps(tx, app.email, member.id, hood.id);
    await tx
      .update(applications)
      .set({ status: "approved", decidedAt: new Date(), decidedBy: adminId, memberId: member.id, photo: null, photoType: null })
      .where(eq(applications.id, id));
    return { email: app.email, firstName: app.firstName, neighborhoodName: hood.name };
  });
}

// decline, with an optional note for the applicant; the address and photo go
export async function declineApplication(adminId: number, id: string, note: string): Promise<Decision> {
  await assertAdmin(adminId);
  const trimmed = note.trim();
  if (trimmed.length > APPLICATION_NOTE_MAX) throw new ApplicationError(`Keep the note under ${APPLICATION_NOTE_MAX} characters.`);
  return db.transaction(async (tx) => {
    const [app] = await tx.select().from(applications).where(eq(applications.id, id)).for("update");
    if (!app || app.status !== "pending") throw new ApplicationError("That application has already been decided.");
    const [hood] = await tx.select({ name: circles.name }).from(circles).where(eq(circles.id, app.neighborhoodId));
    await tx
      .update(applications)
      .set({ status: "declined", decidedAt: new Date(), decidedBy: adminId, note: trimmed || null, photo: null, photoType: null })
      .where(eq(applications.id, id));
    return { email: app.email, firstName: app.firstName, neighborhoodName: hood?.name ?? "", ...(trimmed ? { note: trimmed } : {}) };
  });
}

// `npm run admin`: make members system admins, or stop them being one
export async function setAdmins(emails: string[], admin: boolean): Promise<string[]> {
  const rows = await db
    .update(members)
    .set({ isAdmin: admin })
    .where(inArray(sql`lower(${members.email})`, emails.map(normalizeEmail)))
    .returning({ email: members.email });
  return rows.flatMap((r) => (r.email ? [r.email] : []));
}
