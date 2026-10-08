import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { and, asc, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "./client";
import { UserFacingError } from "./errors";
import { readPhoto } from "./members";
import { applications, circleMembers, circles, memberPhotos, members, user } from "./schema";
import { APPLICATION_NOTE_MAX, BETA_AGREEMENT_VERSION, validateApplication, type ApplicationInput } from "@/lib/applications.util";
import { SMS_CONSENT_NOTICE, normalizePhone } from "@/lib/phone.util";

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
const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
const codeMatches = (given: string, hash: string) => timingSafeEqual(Buffer.from(hashCode(given.trim())), Buffer.from(hash));
const normalizeEmail = (email: string) => email.trim().toLowerCase();

// the neighborhoods someone can apply to live in, for the apply form
export async function getNeighborhoodsForApplying(): Promise<{ id: string; name: string }[]> {
  return db.select({ id: circles.id, name: circles.name }).from(circles).where(eq(circles.type, "neighborhood")).orderBy(asc(circles.name));
}

/* Start an application: checked, stored unconfirmed, and given a confirmation
   code for the caller to email — and, if they gave a mobile number, a second
   code for the caller to text it, with the opt-in they were shown recorded.
   Starting again with the same address replaces an unconfirmed one (a typo,
   a lost email), but not one already waiting for review. `agreementVersion`
   is the version of the beta terms and privacy notes the applicant agreed
   to, which must be the current one. Returns the new application's id, its
   codes and the number they go to. */
export async function startApplication(
  input: ApplicationInput,
  photo: Blob,
  agreementVersion: string
): Promise<{ id: string; code: string; phone: string | null; phoneCode: string | null }> {
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
  const phone = input.phone.trim() ? normalizePhone(input.phone) : null;
  if (phone) {
    const [owner] = await db.select({ id: members.id }).from(members).where(eq(members.phone, phone));
    if (owner) throw new ApplicationError("That mobile number already belongs to a member.");
  }

  const id = randomUUID();
  const code = newCode();
  const phoneCode = phone ? newCode() : null;
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
      address: input.address.trim(),
      photo: data,
      photoType: contentType,
      agreementVersion,
      agreedAt: new Date(),
      confirmCodeHash: hashCode(code),
      confirmExpiresAt: new Date(Date.now() + CONFIRM_CODE_MINUTES * 60_000),
      ...(phone && phoneCode ? { phone, phoneCodeHash: hashCode(phoneCode), smsConsent: SMS_CONSENT_NOTICE, smsConsentAt: new Date() } : {}),
    });
  });
  return { id, code, phone, phoneCode };
}

// the address of an application still waiting to be confirmed
export async function unconfirmedApplicationEmail(id: string): Promise<string> {
  const [row] = await db.select({ email: applications.email, status: applications.status }).from(applications).where(eq(applications.id, id));
  if (!row || row.status !== "unconfirmed") throw new ApplicationError("That application has already been confirmed, or has expired — start again.");
  return row.email;
}

/* Fresh codes for an application still waiting to be confirmed — when the
   first email or text didn't arrive: a new emailed one, and a new texted one
   if it has a number. Returns where to send them. */
export async function renewConfirmationCode(id: string): Promise<{ email: string; code: string; phone: string | null; phoneCode: string | null }> {
  const email = await unconfirmedApplicationEmail(id);
  const [row] = await db.select({ phone: applications.phone }).from(applications).where(eq(applications.id, id));
  const phone = row?.phone ?? null;
  const code = newCode();
  const phoneCode = phone ? newCode() : null;
  await db
    .update(applications)
    .set({
      confirmCodeHash: hashCode(code),
      confirmExpiresAt: new Date(Date.now() + CONFIRM_CODE_MINUTES * 60_000),
      confirmAttempts: 0,
      ...(phoneCode ? { phoneCodeHash: hashCode(phoneCode), phoneConfirmAttempts: 0 } : {}),
    })
    .where(eq(applications.id, id));
  return { email, code, phone, phoneCode };
}

/* The emailed code proves the address is theirs, and the texted one (if they
   gave a number) that the number is; together they send the application on
   to the admins. Each counts its own wrong tries. */
export async function confirmApplication(id: string, code: string, phoneCode?: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(applications).where(eq(applications.id, id)).for("update");
    if (!row || row.status !== "unconfirmed" || !row.confirmCodeHash) throw new ApplicationError("That application has already been confirmed, or has expired — start again.");
    if (row.confirmAttempts >= CONFIRM_MAX_ATTEMPTS || row.phoneConfirmAttempts >= CONFIRM_MAX_ATTEMPTS) throw new ApplicationError("Too many wrong codes — send yourself new ones.");
    if (!row.confirmExpiresAt || row.confirmExpiresAt < new Date()) throw new ApplicationError("Those codes have expired — send yourself new ones.");
    if (!codeMatches(code, row.confirmCodeHash)) {
      await tx.update(applications).set({ confirmAttempts: row.confirmAttempts + 1 }).where(eq(applications.id, id));
      throw new ApplicationError("The emailed code doesn't match — check the email and try again.");
    }
    if (row.phoneCodeHash && !codeMatches(phoneCode ?? "", row.phoneCodeHash)) {
      await tx.update(applications).set({ phoneConfirmAttempts: row.phoneConfirmAttempts + 1 }).where(eq(applications.id, id));
      throw new ApplicationError("The texted code doesn't match — check the text and try again.");
    }
    await tx
      .update(applications)
      .set({ status: "pending", submittedAt: new Date(), confirmCodeHash: null, confirmExpiresAt: null, phoneCodeHash: null })
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
  address: string;
  submittedAt: string;
}

const pendingColumns = {
  id: applications.id,
  firstName: applications.firstName,
  lastName: applications.lastName,
  email: applications.email,
  neighborhoodId: applications.neighborhoodId,
  neighborhoodName: circles.name,
  address: applications.address,
  submittedAt: applications.submittedAt,
};

function toPending(r: { id: string; firstName: string; lastName: string; email: string; neighborhoodId: string; neighborhoodName: string; address: string | null; submittedAt: Date | null }): PendingApplication {
  return { ...r, address: r.address ?? "", submittedAt: (r.submittedAt ?? new Date()).toISOString() };
}

// what's waiting for review, oldest first — without the photos, which the
// admin-only photo route serves one at a time
export async function getPendingApplications(adminId: number): Promise<PendingApplication[]> {
  await assertAdmin(adminId);
  const rows = await db
    .select(pendingColumns)
    .from(applications)
    .innerJoin(circles, eq(circles.id, applications.neighborhoodId))
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

    // their confirmed number comes with them, texts on — unless a member has
    // claimed it since they applied, when they can add another in Settings
    const [phoneTaken] = app.phone ? await tx.select({ id: members.id }).from(members).where(eq(members.phone, app.phone)) : [];
    const phone =
      app.phone && !phoneTaken
        ? { phone: app.phone, phoneVerifiedAt: app.submittedAt ?? new Date(), smsConsent: app.smsConsent, smsConsentAt: app.smsConsentAt, notifySms: true }
        : {};
    const [member] = await tx
      .insert(members)
      .values({ name: app.firstName, lastName: app.lastName, pronouns: "", role: "", bio: "", email: app.email, ...phone })
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
    await tx
      .update(applications)
      .set({ status: "approved", decidedAt: new Date(), decidedBy: adminId, memberId: member.id, address: null, photo: null, photoType: null, phone: null })
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
      .set({ status: "declined", decidedAt: new Date(), decidedBy: adminId, note: trimmed || null, address: null, photo: null, photoType: null, phone: null })
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
