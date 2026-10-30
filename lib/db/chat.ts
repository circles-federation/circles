import { and, asc, count, desc, eq, gt, gte, inArray, isNull, lt, max, sql } from "drizzle-orm";
import { CHAT_MENTIONS_MAX, canEditChat, validateChatBody } from "@/lib/chat.util";
import { circleHasChat } from "@/lib/circles.util";
import type { ChatMessage } from "@/lib/types";
import { db, type Tx } from "./client";
import { UserFacingError } from "./errors";
import { circleChatMentions, circleChatMessages, circleChatReads, circleMembers, circleProposals, circles, members, proposalNotifications } from "./schema";

/* A circle's chat thread, its members' alone: this file is where that's held
   to. Every read and write checks the member belongs to a circle that has
   chat (circleHasChat: any circle with a page, a group included, never a
   neighborhood or the city), and what's written is validated again here.
   Messages are not part of AppState: a thread is unbounded, so it's read a
   page at a time, and kept current by the stream (lib/db/chat-stream.ts),
   which every write here wakes with a NOTIFY in its own transaction, so it
   only goes out if the write committed. Like the rest of lib/db, it takes the
   acting member's id and never reads the session itself. */

export class ChatError extends UserFacingError {}

export const CHAT_CHANNEL = "circle_chat";

// how many a member may send, across every circle
const PER_MINUTE = 30;
const PAGE = 50;
const CHANGES_MAX = 500;

type MessageRow = typeof circleChatMessages.$inferSelect;

export function toChatMessage(row: MessageRow, mentions: number[], reviewProposalId?: string): ChatMessage {
  return {
    id: row.id,
    circleId: row.circleId,
    ...(row.authorId !== null ? { authorId: row.authorId } : {}),
    scheme: row.scheme,
    body: row.body,
    mentions,
    createdAt: row.createdAt.toISOString(),
    ...(row.editedAt ? { editedAt: row.editedAt.toISOString() } : {}),
    ...(row.deletedAt ? { deletedAt: row.deletedAt.toISOString() } : {}),
    rev: row.rev,
    ...(reviewProposalId ? { reviewProposalId } : {}),
  };
}

// messages with who they were addressed to, and the open proposal to remove
// each, if there is one
async function withMentions(rows: MessageRow[]): Promise<ChatMessage[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const found = await db.select().from(circleChatMentions).where(inArray(circleChatMentions.messageId, ids));
  const byMessage = new Map<number, number[]>();
  for (const m of found) byMessage.set(m.messageId, [...(byMessage.get(m.messageId) ?? []), m.memberId]);
  const reviews = await db
    .select({ messageId: circleProposals.chatMessageId, id: circleProposals.id })
    .from(circleProposals)
    .where(and(inArray(circleProposals.chatMessageId, ids), eq(circleProposals.status, "open"), eq(circleProposals.kind, "remove_message")));
  const reviewOf = new Map(reviews.map((r) => [r.messageId, r.id]));
  return rows.map((r) => toChatMessage(r, byMessage.get(r.id) ?? [], reviewOf.get(r.id)));
}

async function rosterOf(circleId: string): Promise<number[]> {
  return (await db.select({ id: circleMembers.memberId }).from(circleMembers).where(eq(circleMembers.circleId, circleId))).map((r) => r.id);
}

async function assertChatCircle(circleId: string): Promise<void> {
  const [circle] = await db.select({ type: circles.type, parentId: circles.parentId, archivedAt: circles.archivedAt }).from(circles).where(eq(circles.id, circleId));
  if (!circle || circle.archivedAt || !circleHasChat(circle)) throw new ChatError("That circle doesn't have a chat.");
}

/* Refuses unless `memberId` belongs to a live circle with chat, as if it
   doesn't exist. A yes or no, so it doesn't read the roster. */
export async function assertChatMember(memberId: number, circleId: string): Promise<void> {
  await assertChatCircle(circleId);
  const [row] = await db.select({ id: circleMembers.memberId }).from(circleMembers).where(and(eq(circleMembers.circleId, circleId), eq(circleMembers.memberId, memberId))).limit(1);
  if (!row) throw new ChatError("Only the circle's members can read or write its chat.");
}

// the circle's members, on the same terms, for what needs to know who they are
export async function chatMembersOf(memberId: number, circleId: string): Promise<number[]> {
  await assertChatCircle(circleId);
  const ids = await rosterOf(circleId);
  if (!ids.includes(memberId)) throw new ChatError("Only the circle's members can read or write its chat.");
  return ids;
}

// the circles whose threads this member reads: theirs, live and with chat
export async function chatCircleIdsOf(memberId: number): Promise<string[]> {
  const rows = await db
    .select({ id: circles.id, type: circles.type, parentId: circles.parentId })
    .from(circles)
    .innerJoin(circleMembers, and(eq(circleMembers.circleId, circles.id), eq(circleMembers.memberId, memberId)))
    .where(sql`${circles.archivedAt} is null`);
  return rows.filter(circleHasChat).map((c) => c.id);
}

// a page of the thread, oldest first: the newest `PAGE`, or those just before `before`
export async function getChatMessages(memberId: number, circleId: string, before?: number): Promise<{ messages: ChatMessage[]; more: boolean }> {
  await assertChatMember(memberId, circleId);
  if (before !== undefined && !Number.isSafeInteger(before)) throw new ChatError("That isn't a place in the thread.");
  const rows = await db
    .select()
    .from(circleChatMessages)
    .where(and(eq(circleChatMessages.circleId, circleId), before !== undefined ? lt(circleChatMessages.id, before) : undefined))
    .orderBy(desc(circleChatMessages.id))
    .limit(PAGE + 1);
  return { messages: await withMentions(rows.slice(0, PAGE).reverse()), more: rows.length > PAGE };
}

/* Everything in the member's circles that's new or changed since `rev`, for a
   stream that has just reconnected. More than it will send at once means the
   client should read the threads afresh instead. */
export async function getChatChanges(memberId: number, rev: number): Promise<{ messages: ChatMessage[]; truncated: boolean }> {
  const ids = await chatCircleIdsOf(memberId);
  if (ids.length === 0) return { messages: [], truncated: false };
  const rows = await db
    .select()
    .from(circleChatMessages)
    .where(and(inArray(circleChatMessages.circleId, ids), gt(circleChatMessages.rev, rev)))
    .orderBy(asc(circleChatMessages.rev))
    .limit(CHANGES_MAX + 1);
  return { messages: await withMentions(rows.slice(0, CHANGES_MAX)), truncated: rows.length > CHANGES_MAX };
}

// the newest version of any message: where a stream with no history begins
export async function getChatRev(): Promise<number> {
  const [row] = await db.select({ rev: sql<number>`coalesce(max(${circleChatMessages.rev}), 0)::float8` }).from(circleChatMessages);
  return row?.rev ?? 0;
}

/* Announces a message to the stream: as new, or (`update`) as changed, which
   the app takes as news only for the first, so an edit or a message going
   under review isn't counted as unread. */
const wake = (tx: Tx, id: number, update = false) => tx.execute(sql`select pg_notify(${CHAT_CHANNEL}, ${update ? `${id}:u` : String(id)})`);

/* A message's state changed without its text (it went under review, or came
   back): a new version, so every open app updates it. */
export async function touchChatMessage(tx: Tx, id: number): Promise<void> {
  await tx.update(circleChatMessages).set({ rev: sql`nextval('circle_chat_rev_seq')` }).where(eq(circleChatMessages.id, id));
  await wake(tx, id, true);
}

/* Write to a circle's thread. `mentions` are who it's addressed to: those
   that aren't its members, or are the author, are dropped, and when any are
   left only they are notified. */
export async function sendChatMessage(authorId: number, circleId: string, input: { body: string; mentions: number[] }): Promise<ChatMessage> {
  const problem = validateChatBody(input.body);
  if (problem) throw new ChatError(problem);
  const memberIds = await chatMembersOf(authorId, circleId);

  const [{ n } = { n: 0 }] = await db
    .select({ n: count() })
    .from(circleChatMessages)
    .where(and(eq(circleChatMessages.authorId, authorId), gte(circleChatMessages.createdAt, new Date(Date.now() - 60_000))));
  if (n >= PER_MINUTE) throw new ChatError("You're sending messages very quickly. Wait a moment.");

  const mentions = [...new Set(input.mentions)].filter((id) => id !== authorId && memberIds.includes(id)).slice(0, CHAT_MENTIONS_MAX);
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(circleChatMessages).values({ circleId, authorId, body: input.body.trim() }).returning();
    if (!row) throw new Error("Chat message insert returned nothing.");
    if (mentions.length > 0) await tx.insert(circleChatMentions).values(mentions.map((memberId) => ({ messageId: row.id, memberId })));
    await wake(tx, row.id);
    return toChatMessage(row, mentions);
  });
}

// the author's own live message, locked for the change that follows
async function lockOwn(tx: Tx, memberId: number, id: number): Promise<MessageRow> {
  const [row] = await tx.select().from(circleChatMessages).where(eq(circleChatMessages.id, id)).for("update");
  if (!row || row.authorId !== memberId || row.deletedAt) throw new ChatError("That message doesn't exist.");
  return row;
}

// the author changes what they wrote, for a little while after writing it
export async function editChatMessage(memberId: number, id: number, body: string): Promise<ChatMessage> {
  const problem = validateChatBody(body);
  if (problem) throw new ChatError(problem);
  return db.transaction(async (tx) => {
    const row = await lockOwn(tx, memberId, id);
    await assertChatMember(memberId, row.circleId);
    if (!canEditChat(row.createdAt.toISOString(), Date.now())) throw new ChatError("It's too late to edit that message.");
    // what's under review is what its circle is being asked about
    const [review] = await tx.select({ id: circleProposals.id }).from(circleProposals).where(and(eq(circleProposals.chatMessageId, id), eq(circleProposals.status, "open")));
    if (review) throw new ChatError("It can't be edited while its circle is deciding whether to remove it.");
    const [updated] = await tx
      .update(circleChatMessages)
      .set({ body: body.trim(), editedAt: new Date(), rev: sql`nextval('circle_chat_rev_seq')` })
      .where(eq(circleChatMessages.id, id))
      .returning();
    if (!updated) throw new Error("Chat message update returned nothing.");
    await wake(tx, id, true);
    const mentions = (await tx.select().from(circleChatMentions).where(eq(circleChatMentions.messageId, id))).map((m) => m.memberId);
    return toChatMessage(updated, mentions);
  });
}

// the author takes back what they wrote; the message stays as a gap in the thread
export async function deleteChatMessage(memberId: number, id: number): Promise<ChatMessage> {
  return db.transaction(async (tx) => {
    // A proposal passing or being withdrawn locks its own row and then this
    // message's, so this takes them in that order too, or the two can deadlock.
    const [peek] = await tx.select({ authorId: circleChatMessages.authorId, circleId: circleChatMessages.circleId }).from(circleChatMessages).where(eq(circleChatMessages.id, id));
    if (!peek || peek.authorId !== memberId) throw new ChatError("That message doesn't exist.");
    await assertChatMember(memberId, peek.circleId);
    // a proposal to remove it is moot: closed, and its unsent notices with it
    const closed = await tx
      .update(circleProposals)
      .set({ status: "withdrawn", decidedAt: new Date() })
      .where(and(eq(circleProposals.chatMessageId, id), eq(circleProposals.kind, "remove_message"), eq(circleProposals.status, "open")))
      .returning({ id: circleProposals.id });
    if (closed.length > 0) await tx.delete(proposalNotifications).where(and(inArray(proposalNotifications.proposalId, closed.map((c) => c.id)), isNull(proposalNotifications.sentAt)));
    await lockOwn(tx, memberId, id);
    return tombstone(tx, id);
  });
}

/* A proposal to remove a message quotes it, so that it still reads once the
   message is gone; once it is gone the quote goes too, from every proposal
   that named it. */
async function redactRemovals(tx: Tx, messageId: number): Promise<void> {
  const rows = await tx.select({ id: circleProposals.id, lines: circleProposals.lines }).from(circleProposals).where(and(eq(circleProposals.chatMessageId, messageId), eq(circleProposals.kind, "remove_message")));
  for (const r of rows) {
    const lines = r.lines.map((l) => (l.label === "Message" ? { ...l, after: "(removed)" } : l));
    await tx.update(circleProposals).set({ lines }).where(eq(circleProposals.id, r.id));
  }
}

/* Clears a message's text and who it was addressed to, leaving the row. Used
   by the author's delete and, later, by a circle's consent to remove it. */
export async function tombstone(tx: Tx, id: number): Promise<ChatMessage> {
  const [updated] = await tx
    .update(circleChatMessages)
    .set({ body: "", deletedAt: new Date(), rev: sql`nextval('circle_chat_rev_seq')` })
    .where(eq(circleChatMessages.id, id))
    .returning();
  if (!updated) throw new Error("Chat message update returned nothing.");
  await tx.delete(circleChatMentions).where(eq(circleChatMentions.messageId, id));
  await redactRemovals(tx, id);
  await wake(tx, id, true);
  return toChatMessage(updated, []);
}

/* How many messages each of the member's circles has that they haven't read:
   those after where they last read to, by anyone else, not deleted. A circle
   they've never opened counts its whole thread. */
export async function getChatUnread(memberId: number): Promise<Record<string, number>> {
  const ids = await chatCircleIdsOf(memberId);
  if (ids.length === 0) return {};
  const m = circleChatMessages;
  const rows = await db
    .select({ circleId: m.circleId, n: count() })
    .from(m)
    .leftJoin(circleChatReads, and(eq(circleChatReads.circleId, m.circleId), eq(circleChatReads.memberId, memberId)))
    .where(and(inArray(m.circleId, ids), isNull(m.deletedAt), sql`${m.authorId} is distinct from ${memberId}`, sql`${m.id} > coalesce(${circleChatReads.lastReadId}, 0)`))
    .groupBy(m.circleId);
  return Object.fromEntries(rows.map((r) => [r.circleId, r.n]));
}

// read up to here: never moves backwards
export async function markChatRead(memberId: number, circleId: string, lastReadId: number): Promise<void> {
  await assertChatMember(memberId, circleId);
  if (!Number.isSafeInteger(lastReadId) || lastReadId < 1) throw new ChatError("That isn't a place in the thread.");
  // never past the newest message, or later ones would count as read before they're written
  const [newest] = await db.select({ id: max(circleChatMessages.id) }).from(circleChatMessages).where(eq(circleChatMessages.circleId, circleId));
  if (!newest?.id) return;
  lastReadId = Math.min(lastReadId, newest.id);
  await db
    .insert(circleChatReads)
    .values({ circleId, memberId, lastReadId })
    .onConflictDoUpdate({ target: [circleChatReads.circleId, circleChatReads.memberId], set: { lastReadId: sql`greatest(${circleChatReads.lastReadId}, excluded.last_read_id)` } });
}

/* A message and the members of its circle, for the stream to hand on: only
   a member is sent it. Null when it's gone (its circle was deleted). */
export async function getChatForFanout(id: number): Promise<{ message: ChatMessage; memberIds: number[] } | null> {
  const [row] = await db.select().from(circleChatMessages).where(eq(circleChatMessages.id, id));
  if (!row) return null;
  const [message] = await withMentions([row]);
  const memberIds = await rosterOf(row.circleId);
  return message ? { message, memberIds } : null;
}

/* Who to tell of a new message, and what to say. A message that tags people
   tells only them; one that doesn't tells the whole circle. Either way not its
   author, and nothing for one deleted since or whose circle is gone. */
export async function getChatNoticeData(id: number) {
  const [row] = await db
    .select({ message: circleChatMessages, circleName: circles.name })
    .from(circleChatMessages)
    .innerJoin(circles, eq(circles.id, circleChatMessages.circleId))
    .where(eq(circleChatMessages.id, id));
  if (!row || row.message.deletedAt) return null;
  const { message } = row;
  const tagged = (await db.select({ id: circleChatMentions.memberId }).from(circleChatMentions).where(eq(circleChatMentions.messageId, id))).map((r) => r.id);
  const circleMemberIds = await rosterOf(message.circleId);
  const audience = tagged.length > 0 ? tagged.filter((m) => circleMemberIds.includes(m)) : circleMemberIds;
  const [author] = message.authorId !== null ? await db.select({ name: members.name }).from(members).where(eq(members.id, message.authorId)) : [];
  return {
    id,
    circleId: message.circleId,
    circleName: row.circleName,
    authorName: author?.name ?? "A former member",
    scheme: message.scheme,
    body: message.body,
    tagged: tagged.length > 0,
    recipientIds: audience.filter((m) => m !== message.authorId),
  };
}
