import { randomUUID } from "node:crypto";
import { and, count, desc, eq, gte, inArray, isNull, ne } from "drizzle-orm";
import { circleHasInbox } from "@/lib/circles.util";
import { validateMessage, type MessageInput } from "@/lib/messages.util";
import type { CircleMessage } from "@/lib/types";
import { db } from "./client";
import { UserFacingError } from "./errors";
import { circleMembers, circleMessageReads, circleMessages, circles, members } from "./schema";

/* A circle's Inbox (lib/circles.util's circleHasInbox: a Circle, collective
   or co-op whose members have consented to one): anyone signed in may write
   to it from its wiki (and anyone else from its public wiki, lib/db/
   guest-messages.ts), and only its members are ever sent what's written,
   which is held to here. Writing needs the sender's consent to be replied to
   at their email address, which goes with the message. Any member can mark
   one as theirs to handle (or another member's), or Done. Like the rest of
   lib/db, it takes the acting member's id and never reads the session. */

export class MessageError extends UserFacingError {}

// how many a member may send, across every circle, so a form that reaches a
// whole circle can't be used to flood one
const PER_HOUR = 5;
const PER_DAY = 20;

type MessageRow = typeof circleMessages.$inferSelect;

function toMessage(row: MessageRow, read: boolean): CircleMessage {
  return {
    id: row.id,
    circleId: row.circleId,
    ...(row.senderId !== null ? { senderId: row.senderId } : {}),
    ...(row.fromGuest ? { guest: true as const } : {}),
    senderName: row.senderName,
    replyEmail: row.replyEmail,
    subject: row.subject,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    read,
    ...(row.assigneeId !== null ? { assigneeId: row.assigneeId } : {}),
    ...(row.doneAt ? { doneAt: row.doneAt.toISOString() } : {}),
  };
}

// the circles a member reads the messages of: theirs, with an Inbox on
async function inboxCirclesOf(memberId: number): Promise<string[]> {
  const rows = await db
    .select({ id: circles.id, type: circles.type, parentId: circles.parentId, inbox: circles.inbox })
    .from(circles)
    .innerJoin(circleMembers, and(eq(circleMembers.circleId, circles.id), eq(circleMembers.memberId, memberId)))
    .where(and(eq(circles.inbox, true), isNull(circles.archivedAt)));
  return rows.filter(circleHasInbox).map((c) => c.id);
}

// every message to every circle this member reads the Inbox of, newest
// first, with whether they've opened each: AppState's `messages`
export async function getMessagesForMember(memberId: number): Promise<CircleMessage[]> {
  const ids = await inboxCirclesOf(memberId);
  if (ids.length === 0) return [];
  const rows = await db
    .select({ message: circleMessages, readAt: circleMessageReads.readAt })
    .from(circleMessages)
    .leftJoin(circleMessageReads, and(eq(circleMessageReads.messageId, circleMessages.id), eq(circleMessageReads.memberId, memberId)))
    .where(inArray(circleMessages.circleId, ids))
    .orderBy(desc(circleMessages.createdAt));
  return rows.map((r) => toMessage(r.message, r.readAt !== null));
}

/* Write to a circle: one with its Inbox on, from anyone signed in, as often
   as PER_HOUR and PER_DAY allow. The reply address is the sender's own,
   taken now, and they must have agreed to it. */
export async function sendMessage(senderId: number, circleId: string, input: MessageInput): Promise<{ id: string }> {
  const problem = validateMessage(input);
  if (problem) throw new MessageError(problem);
  const [circle] = await db.select().from(circles).where(eq(circles.id, circleId));
  if (!circle || circle.archivedAt || !circleHasInbox(circle)) throw new MessageError("That circle isn't taking messages.");
  const [sender] = await db.select({ name: members.name, email: members.email }).from(members).where(eq(members.id, senderId));
  if (!sender?.email) throw new MessageError("Your account has no email address for them to reply to.");

  const since = (ms: number) => new Date(Date.now() - ms);
  const sent = async (ms: number) => (await db.select({ n: count() }).from(circleMessages).where(and(eq(circleMessages.senderId, senderId), gte(circleMessages.createdAt, since(ms)))))[0]?.n ?? 0;
  if ((await sent(60 * 60_000)) >= PER_HOUR || (await sent(24 * 60 * 60_000)) >= PER_DAY) throw new MessageError("You've sent a lot of messages lately. Try again a little later.");

  const id = randomUUID();
  await db.insert(circleMessages).values({ id, circleId, senderId, senderName: sender.name, replyEmail: sender.email, subject: input.subject.trim(), body: input.body.trim() });
  return { id };
}

/* The message, if `memberId` reads its circle's Inbox, with whether they've
   opened it; refused otherwise, as if it doesn't exist. */
async function messageFor(memberId: number, id: string): Promise<CircleMessage> {
  const [row] = await db
    .select({ message: circleMessages, readAt: circleMessageReads.readAt })
    .from(circleMessages)
    .leftJoin(circleMessageReads, and(eq(circleMessageReads.messageId, circleMessages.id), eq(circleMessageReads.memberId, memberId)))
    .where(eq(circleMessages.id, id));
  if (!row || !(await inboxCirclesOf(memberId)).includes(row.message.circleId)) throw new MessageError("That message doesn't exist.");
  return toMessage(row.message, row.readAt !== null);
}

// opened by this member: no longer new to them
export async function markMessageRead(memberId: number, id: string): Promise<CircleMessage> {
  const message = await messageFor(memberId, id);
  if (message.read) return message;
  await db.insert(circleMessageReads).values({ messageId: id, memberId }).onConflictDoNothing();
  return { ...message, read: true };
}

/* Who's handling it (writing back to its sender): a member of its circle,
   themselves or another, or no one. */
export async function assignMessage(memberId: number, id: string, assigneeId: number | null): Promise<CircleMessage> {
  const message = await messageFor(memberId, id);
  if (assigneeId !== null) {
    const [held] = await db.select({ id: circleMembers.memberId }).from(circleMembers).where(and(eq(circleMembers.circleId, message.circleId), eq(circleMembers.memberId, assigneeId)));
    if (!held) throw new MessageError("Only a member of the circle can handle its messages.");
  }
  await db.update(circleMessages).set({ assigneeId }).where(eq(circleMessages.id, id));
  return messageFor(memberId, id);
}

// filed away as dealt with, or back in the open
export async function setMessageDone(memberId: number, id: string, done: boolean): Promise<CircleMessage> {
  await messageFor(memberId, id);
  await db.update(circleMessages).set(done ? { doneAt: new Date(), doneBy: memberId } : { doneAt: null, doneBy: null }).where(eq(circleMessages.id, id));
  return messageFor(memberId, id);
}

/* Who to tell of a new message, and what to say: its circle's members but
   its sender, each with their email if they take notifications by email. */
export async function getMessageNoticeData(id: string) {
  const [row] = await db
    .select({ message: circleMessages, circleName: circles.name })
    .from(circleMessages)
    .innerJoin(circles, eq(circles.id, circleMessages.circleId))
    .where(eq(circleMessages.id, id));
  if (!row) return null;
  const { message } = row;
  const recipients = await db
    .select({ id: members.id, name: members.name, email: members.email, notifyEmail: members.notifyEmail })
    .from(circleMembers)
    .innerJoin(members, eq(members.id, circleMembers.memberId))
    .where(and(eq(circleMembers.circleId, message.circleId), message.senderId !== null ? ne(circleMembers.memberId, message.senderId) : undefined));
  return {
    id,
    circleId: message.circleId,
    circleName: row.circleName,
    senderName: message.senderName,
    subject: message.subject,
    body: message.body,
    recipients: recipients.map((r) => ({ memberId: r.id, name: r.name, ...(r.email && r.notifyEmail ? { email: r.email } : {}) })),
  };
}

// a member who leaves a circle no longer handles its messages (leaveCircle)
export async function unassignMessagesFromCircle(tx: Pick<typeof db, "update">, memberId: number, circleId: string): Promise<void> {
  await tx.update(circleMessages).set({ assigneeId: null }).where(and(eq(circleMessages.circleId, circleId), eq(circleMessages.assigneeId, memberId)));
}
