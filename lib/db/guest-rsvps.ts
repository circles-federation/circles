import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { and, count, eq, gt, inArray, isNotNull, max, sql } from "drizzle-orm";
import { db } from "./client";
import { UserFacingError } from "./errors";
import { getEvent } from "./events";
import { enqueueGuestConfirmation } from "./guest-notifications";
import { getMemberByEmail } from "./members";
import { eventGuestRsvps, eventShareLinks } from "./schema";
import { hasEnded } from "@/lib/events.util";
import { awaitingConsent, isMeeting } from "@/lib/governance.util";
import { validateGuest } from "@/lib/guest-rsvp.util";

/* Someone without an account RSVPs to an event from its share link
   (/e/[token]): a name and an email address, proved theirs by a code emailed
   to them, as an application's is. They're not a member and get no login; the
   row is the whole of it. Until the code is entered it's unconfirmed and no one
   sees it. Public, so every limit lives here rather than in the form: a code
   goes to whatever address is typed, which is someone's real inbox. */

export class GuestRsvpError extends UserFacingError {}

export const GUEST_CODE_MINUTES = 30;
const CODE_MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60_000;
// codes started for one event in an hour, so a link can't be used to mail the world
const STARTS_PER_EVENT_PER_HOUR = 50;

const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");
const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

// the event a link opens, if it is still one a guest can say they're going to:
// decided, not cancelled or over, and with plain RSVPs (a role is taken by a member)
async function openEventFor(token: string) {
  const [link] = await db.select().from(eventShareLinks).where(eq(eventShareLinks.token, token));
  const event = link ? await getEvent(link.eventId) : null;
  if (!link || !event || isMeeting(event) || awaitingConsent(event)) throw new GuestRsvpError("That link doesn't lead to an event any more.");
  if (event.cancelled) throw new GuestRsvpError("This event has been cancelled.");
  if (hasEnded(event)) throw new GuestRsvpError("This event is over.");
  if ((event.roles ?? []).length > 0) throw new GuestRsvpError("This event has roles to sign up for, which needs a Circles account.");
  return { event, invitedBy: link.memberId };
}

function cooldownError(lastSent: Date | null): string | null {
  const wait = lastSent ? RESEND_COOLDOWN_MS - (Date.now() - lastSent.getTime()) : 0;
  return wait > 0 ? `A code was just sent — check your inbox, or try again in ${Math.ceil(wait / 1000)} seconds.` : null;
}

// a code for this name and address, to be emailed by the caller. An address
// that's already confirmed for this event is sent one too (it's how they get
// back to their RSVP), but keeps the name it was confirmed with.
export async function startGuestRsvp(token: string, name: string, email: string): Promise<{ id: string; code: string; email: string; eventTitle: string }> {
  const problem = validateGuest(name, email);
  if (problem) throw new GuestRsvpError(problem);
  const address = email.trim();
  const { event, invitedBy } = await openEventFor(token);
  // the address of a member is theirs to RSVP with by signing in
  if (await getMemberByEmail(address)) throw new GuestRsvpError("That email belongs to a Circles member. Sign in to RSVP.");

  const [sent] = await db.select({ lastSent: max(eventGuestRsvps.codeSentAt) }).from(eventGuestRsvps).where(sql`lower(${eventGuestRsvps.email}) = lower(${address})`);
  const wait = cooldownError(sent?.lastSent ?? null);
  if (wait) throw new GuestRsvpError(wait);

  const [started] = await db
    .select({ recent: count() })
    .from(eventGuestRsvps)
    .where(and(eq(eventGuestRsvps.eventId, event.id), gt(eventGuestRsvps.codeSentAt, new Date(Date.now() - 3_600_000))));
  if ((started?.recent ?? 0) >= STARTS_PER_EVENT_PER_HOUR) throw new GuestRsvpError("Lots of people are RSVPing at once — try again in a little while.");

  const code = newCode();
  const code_ = { codeHash: hashCode(code), codeExpiresAt: new Date(Date.now() + GUEST_CODE_MINUTES * 60_000), codeAttempts: 0, codeSentAt: new Date() };
  const [existing] = await db
    .select({ id: eventGuestRsvps.id })
    .from(eventGuestRsvps)
    .where(and(eq(eventGuestRsvps.eventId, event.id), sql`lower(${eventGuestRsvps.email}) = lower(${address})`));
  const [row] = existing
    ? await db.update(eventGuestRsvps).set(code_).where(eq(eventGuestRsvps.id, existing.id)).returning({ id: eventGuestRsvps.id })
    : await db
        .insert(eventGuestRsvps)
        .values({ id: randomUUID(), eventId: event.id, invitedBy, name: name.trim(), email: address, ...code_ })
        .returning({ id: eventGuestRsvps.id });
  if (!row) throw new GuestRsvpError("Something went wrong — try again in a moment.");
  return { id: row.id, code, email: address, eventTitle: event.title };
}

// a fresh code for an RSVP that's waiting on one
export async function renewGuestCode(id: string): Promise<{ code: string; email: string; eventTitle: string }> {
  const [row] = await db.select().from(eventGuestRsvps).where(eq(eventGuestRsvps.id, id));
  if (!row || !row.codeHash) throw new GuestRsvpError("That RSVP has expired — start again.");
  const wait = cooldownError(row.codeSentAt);
  if (wait) throw new GuestRsvpError(wait);
  const event = await getEvent(row.eventId);
  if (!event) throw new GuestRsvpError("That event doesn't exist.");
  const code = newCode();
  await db
    .update(eventGuestRsvps)
    .set({ codeHash: hashCode(code), codeExpiresAt: new Date(Date.now() + GUEST_CODE_MINUTES * 60_000), codeAttempts: 0, codeSentAt: new Date() })
    .where(eq(eventGuestRsvps.id, id));
  return { code, email: row.email, eventTitle: event.title };
}

// the emailed code makes the RSVP count, and shows the guest's first name in
// the list of who's going
export async function confirmGuestRsvp(id: string, code: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(eventGuestRsvps).where(eq(eventGuestRsvps.id, id)).for("update");
    if (!row || !row.codeHash) throw new GuestRsvpError("That code has already been used, or has expired — start again.");
    if (row.codeAttempts >= CODE_MAX_ATTEMPTS) throw new GuestRsvpError("Too many wrong codes — send yourself a new one.");
    if (!row.codeExpiresAt || row.codeExpiresAt < new Date()) throw new GuestRsvpError("That code has expired — send yourself a new one.");
    if (!timingSafeEqual(Buffer.from(hashCode(code.trim())), Buffer.from(row.codeHash))) {
      await tx.update(eventGuestRsvps).set({ codeAttempts: row.codeAttempts + 1 }).where(eq(eventGuestRsvps.id, id));
      throw new GuestRsvpError("That code doesn't match — check the email and try again.");
    }
    await tx
      .update(eventGuestRsvps)
      .set({ confirmedAt: row.confirmedAt ?? new Date(), codeHash: null, codeExpiresAt: null })
      .where(eq(eventGuestRsvps.id, id));
    // told once, the first time; getting back in with a new code isn't news
    if (row.confirmedAt === null) await enqueueGuestConfirmation(tx, id);
  });
}

// taking back an RSVP: whoever holds its id (the cookie set on confirming) may
export async function cancelGuestRsvp(id: string): Promise<void> {
  await db.delete(eventGuestRsvps).where(eq(eventGuestRsvps.id, id));
}

// this browser's confirmed RSVP to the event, from the ids it holds
export async function findGuestRsvp(ids: string[], eventId: string): Promise<{ id: string; name: string } | null> {
  if (ids.length === 0) return null;
  const [row] = await db
    .select({ id: eventGuestRsvps.id, name: eventGuestRsvps.name })
    .from(eventGuestRsvps)
    .where(and(inArray(eventGuestRsvps.id, ids), eq(eventGuestRsvps.eventId, eventId), isNotNull(eventGuestRsvps.confirmedAt)));
  return row ?? null;
}

// the confirmed guests' first names, in the order they RSVPed
export async function confirmedGuestNames(eventId: string): Promise<string[]> {
  const rows = await db
    .select({ name: eventGuestRsvps.name, confirmedAt: eventGuestRsvps.confirmedAt })
    .from(eventGuestRsvps)
    .where(eq(eventGuestRsvps.eventId, eventId))
    .orderBy(eventGuestRsvps.confirmedAt);
  return rows.flatMap((r) => (r.confirmedAt ? (r.name.split(/\s+/)[0] ?? r.name) : []));
}

// the confirmed RSVP with this id, if this browser holds it (its id is in `ids`,
// from the cookie): who's applying from it, and who invited them
export async function getVerifiedGuest(ids: string[], id: string): Promise<{ id: string; name: string; email: string; eventId: string; invitedBy: number | null } | null> {
  if (!ids.includes(id)) return null;
  const [row] = await db
    .select({ id: eventGuestRsvps.id, name: eventGuestRsvps.name, email: eventGuestRsvps.email, eventId: eventGuestRsvps.eventId, invitedBy: eventGuestRsvps.invitedBy })
    .from(eventGuestRsvps)
    .where(and(eq(eventGuestRsvps.id, id), isNotNull(eventGuestRsvps.confirmedAt)));
  return row ?? null;
}
