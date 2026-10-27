import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { and, count, eq, gt, lt, max, sql } from "drizzle-orm";
import { circleHasInbox } from "@/lib/circles.util";
import { validateGuest } from "@/lib/guest-rsvp.util";
import { validateMessage, type MessageInput } from "@/lib/messages.util";
import { db } from "./client";
import { UserFacingError } from "./errors";
import { getMemberByEmail } from "./members";
import { circleMessages, circles, guestMessageDrafts } from "./schema";

/* Someone without an account writes to a circle from its public wiki
   (/wiki/[id]/write), while its Inbox is on: their name, the address its
   members will answer, proved theirs by a code emailed to it, and the
   message, which waits here (guest_message_drafts) until the code is entered
   and only then reaches the Inbox, marked as from a guest. Public, so every
   limit lives here: a code goes to whatever address is typed, and a circle's
   members are told of every message. */

export class GuestMessageError extends UserFacingError {}

export const GUEST_MESSAGE_CODE_MINUTES = 30;
// messages one address may send in a day, across every circle
export const GUEST_MESSAGES_PER_DAY = 3;
const CODE_MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60_000;
const DAY_MS = 86_400_000;
// codes started for one circle in an hour, so its Inbox can't be flooded
const STARTS_PER_CIRCLE_PER_HOUR = 30;

const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");
const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
const sameAddress = (column: typeof guestMessageDrafts.email | typeof circleMessages.replyEmail, address: string) => sql`lower(${column}) = lower(${address})`;

// the circle, if it's taking messages: its Inbox on, not archived
async function openInbox(circleId: string, tx: Pick<typeof db, "select"> = db) {
  const [circle] = await tx.select().from(circles).where(eq(circles.id, circleId));
  if (!circle || circle.archivedAt || !circleHasInbox(circle)) throw new GuestMessageError("That circle isn't taking messages.");
  return circle;
}

async function sentToday(address: string, tx: Pick<typeof db, "select"> = db): Promise<number> {
  const [row] = await tx
    .select({ n: count() })
    .from(circleMessages)
    .where(and(eq(circleMessages.fromGuest, true), sameAddress(circleMessages.replyEmail, address), gt(circleMessages.createdAt, new Date(Date.now() - DAY_MS))));
  return row?.n ?? 0;
}

const DAILY_LIMIT = `You can send ${GUEST_MESSAGES_PER_DAY} messages a day. Try again tomorrow.`;

function cooldownError(lastSent: Date | null): string | null {
  const wait = lastSent ? RESEND_COOLDOWN_MS - (Date.now() - lastSent.getTime()) : 0;
  return wait > 0 ? `A code was just sent — check your inbox, or try again in ${Math.ceil(wait / 1000)} seconds.` : null;
}

/* The message, held until its code is entered, and the code, to be emailed
   by the caller. Refused before a code goes out for anything that would
   refuse it after: a member's address (theirs to write from by signing in),
   or one that's sent its day's messages already. */
export async function startGuestMessage(
  circleId: string,
  name: string,
  email: string,
  input: MessageInput
): Promise<{ id: string; code: string; email: string; circleName: string }> {
  const problem = validateGuest(name, email) ?? validateMessage(input);
  if (problem) throw new GuestMessageError(problem);
  const address = email.trim();
  const circle = await openInbox(circleId);
  if (await getMemberByEmail(address)) throw new GuestMessageError(`That email belongs to a Circles member. Sign in to write to ${circle.name}.`);
  if ((await sentToday(address)) >= GUEST_MESSAGES_PER_DAY) throw new GuestMessageError(DAILY_LIMIT);

  const [sent] = await db.select({ lastSent: max(guestMessageDrafts.codeSentAt) }).from(guestMessageDrafts).where(sameAddress(guestMessageDrafts.email, address));
  const wait = cooldownError(sent?.lastSent ?? null);
  if (wait) throw new GuestMessageError(wait);

  const [started] = await db
    .select({ n: count() })
    .from(guestMessageDrafts)
    .where(and(eq(guestMessageDrafts.circleId, circleId), gt(guestMessageDrafts.createdAt, new Date(Date.now() - 3_600_000))));
  if ((started?.n ?? 0) >= STARTS_PER_CIRCLE_PER_HOUR) throw new GuestMessageError(`Lots of people are writing to ${circle.name} at once — try again in a little while.`);

  const code = newCode();
  const id = randomUUID();
  await db.insert(guestMessageDrafts).values({
    id,
    circleId,
    name: name.trim(),
    email: address,
    subject: input.subject.trim(),
    body: input.body.trim(),
    codeHash: hashCode(code),
    codeExpiresAt: new Date(Date.now() + GUEST_MESSAGE_CODE_MINUTES * 60_000),
  });
  return { id, code, email: address, circleName: circle.name };
}

// a fresh code for a message that's waiting on one
export async function renewGuestMessageCode(id: string): Promise<{ code: string; email: string; circleName: string }> {
  const [draft] = await db.select().from(guestMessageDrafts).where(eq(guestMessageDrafts.id, id));
  if (!draft) throw new GuestMessageError("That message has expired — write it again.");
  const wait = cooldownError(draft.codeSentAt);
  if (wait) throw new GuestMessageError(wait);
  const circle = await openInbox(draft.circleId);
  const code = newCode();
  await db
    .update(guestMessageDrafts)
    .set({ codeHash: hashCode(code), codeExpiresAt: new Date(Date.now() + GUEST_MESSAGE_CODE_MINUTES * 60_000), codeAttempts: 0, codeSentAt: new Date() })
    .where(eq(guestMessageDrafts.id, id));
  return { code, email: draft.email, circleName: circle.name };
}

/* The emailed code sends the message: into the circle's Inbox, as from a
   guest, with the address it proved as the one to reply to. The day's limit
   and the Inbox are checked again, under a lock on the address, since either
   may have changed while the code was on its way. Returns the message's id,
   for its circle to be told. */
export async function confirmGuestMessage(id: string, code: string): Promise<{ messageId: string }> {
  return db.transaction(async (tx) => {
    const [draft] = await tx.select().from(guestMessageDrafts).where(eq(guestMessageDrafts.id, id)).for("update");
    if (!draft) throw new GuestMessageError("That code has already been used, or has expired — write the message again.");
    if (draft.codeAttempts >= CODE_MAX_ATTEMPTS) throw new GuestMessageError("Too many wrong codes — send yourself a new one.");
    if (draft.codeExpiresAt < new Date()) throw new GuestMessageError("That code has expired — send yourself a new one.");
    if (!timingSafeEqual(Buffer.from(hashCode(code.trim())), Buffer.from(draft.codeHash))) {
      await tx.update(guestMessageDrafts).set({ codeAttempts: draft.codeAttempts + 1 }).where(eq(guestMessageDrafts.id, id));
      throw new GuestMessageError("That code doesn't match — check the email and try again.");
    }
    await openInbox(draft.circleId, tx);
    // serialized per address, so two codes entered at once can't both pass the limit
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`guest-message:${draft.email.toLowerCase()}`}))`);
    if ((await sentToday(draft.email, tx)) >= GUEST_MESSAGES_PER_DAY) throw new GuestMessageError(DAILY_LIMIT);

    const messageId = randomUUID();
    await tx.insert(circleMessages).values({
      id: messageId,
      circleId: draft.circleId,
      senderName: draft.name,
      replyEmail: draft.email,
      subject: draft.subject,
      body: draft.body,
      fromGuest: true,
    });
    await tx.delete(guestMessageDrafts).where(eq(guestMessageDrafts.id, id));
    return { messageId };
  });
}

// messages never confirmed, a day on (the code expires in half an hour). Run
// by the notification poller, once an hour, with the guests' RSVPs.
export async function purgeGuestMessageDrafts(now: Date = new Date()): Promise<void> {
  await db.delete(guestMessageDrafts).where(lt(guestMessageDrafts.createdAt, new Date(now.getTime() - DAY_MS)));
}
