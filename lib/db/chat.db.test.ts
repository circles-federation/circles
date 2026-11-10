import { beforeEach, describe, expect, it } from "vitest";
import { addCircle, addMember, ageChatMessage, join, resetDb } from "./testing";
import { assertChatMember, chatCircleIdsOf, deleteChatMessage, editChatMessage, getChatChanges, getChatForFanout, getChatMessages, getChatNoticeData, getChatRev, getChatUnread, markChatRead, sendChatMessage } from "./chat";
import { proposeChatRemoval } from "./proposals";
import { CHAT_BODY_MAX } from "@/lib/chat.util";

beforeEach(async () => {
  await resetDb();
  for (const id of [1, 2, 3, 4]) await addMember(id);
  await addCircle("city", { type: "other" });
  await addCircle("the903", { type: "neighborhood", parentId: "city" });
  await join("the903", 1, 2, 3, 4);
  await addCircle("garden", { type: "circle", parentId: "the903", name: "Garden" });
  await join("garden", 1, 2, 3);
  await addCircle("club", { type: "group", parentId: "city", name: "Club" });
  await join("club", 1);
});

const say = (who: number, body = "hello", mentions: number[] = [], circle = "garden") => sendChatMessage(who, circle, { body, mentions });

describe("who can use a chat", () => {
  it("is for members of a circle with a page, groups included, and no one else", async () => {
    await expect(say(4)).rejects.toThrow(/Only the circle's members/);
    await expect(getChatMessages(4, "garden")).rejects.toThrow(/Only the circle's members/);
    await expect(say(1, "hi", [], "the903")).rejects.toThrow(/doesn't have a chat/);
    await expect(say(1, "hi", [], "city")).rejects.toThrow(/doesn't have a chat/);
    await expect(say(1, "hi", [], "nope")).rejects.toThrow(/doesn't have a chat/);
    await expect(say(1, "hi", [], "club")).resolves.toBeDefined();
    expect((await chatCircleIdsOf(1)).sort()).toEqual(["club", "garden"]);
    expect(await chatCircleIdsOf(4)).toEqual([]);
    await expect(assertChatMember(2, "club")).rejects.toThrow();
  });
});

describe("writing", () => {
  it("trims the message and refuses an empty or over-long one", async () => {
    expect((await say(1, "  hi  ")).body).toBe("hi");
    await expect(say(1, "   ")).rejects.toThrow(/Write a message/);
    await expect(say(1, "x".repeat(CHAT_BODY_MAX + 1))).rejects.toThrow(/Keep the message/);
  });

  it("keeps only mentions of other members of the circle, once each", async () => {
    const message = await say(1, "hey", [2, 2, 1, 4, 99, 3]);
    expect(message.mentions.sort()).toEqual([2, 3]);
  });

  it("allows 30 a minute from one member", async () => {
    for (let i = 0; i < 30; i++) await say(1, `m${i}`);
    await expect(say(1, "one more")).rejects.toThrow(/very quickly/);
    await expect(say(2, "still fine")).resolves.toBeDefined();
  });
});

describe("reading", () => {
  it("pages the thread oldest first, with whether there's more", async () => {
    for (let i = 1; i <= 55; i++) await say(1 + (i % 3), `m${i}`);
    const first = await getChatMessages(1, "garden");
    expect(first.messages).toHaveLength(50);
    expect(first.more).toBe(true);
    expect(first.messages.at(-1)?.body).toBe("m55");
    const older = await getChatMessages(1, "garden", first.messages[0]!.id);
    expect(older.messages.map((m) => m.body)).toEqual(["m1", "m2", "m3", "m4", "m5"]);
    expect(older.more).toBe(false);
    await expect(getChatMessages(1, "garden", 1.5)).rejects.toThrow(/place in the thread/);
  });

  it("replays what changed since a revision, to members only", async () => {
    const rev0 = await getChatRev();
    const a = await say(1, "first");
    await say(2, "second");
    expect((await getChatChanges(3, rev0)).messages.map((m) => m.body)).toEqual(["first", "second"]);
    await editChatMessage(1, a.id, "first, edited");
    const changes = await getChatChanges(3, rev0);
    expect(changes.messages.map((m) => m.body)).toEqual(["second", "first, edited"]);
    expect(changes.truncated).toBe(false);
    expect(await getChatChanges(4, rev0)).toEqual({ messages: [], truncated: false });
  });

  it("hands a message only to its circle's members for the stream", async () => {
    const { id } = await say(1);
    expect((await getChatForFanout(id))?.memberIds.sort()).toEqual([1, 2, 3]);
    expect(await getChatForFanout(9999)).toBeNull();
  });
});

describe("editing and deleting", () => {
  it("is the author's, within 15 minutes, and marks it edited", async () => {
    const { id } = await say(1, "typo");
    const edited = await editChatMessage(1, id, "fixed");
    expect([edited.body, edited.editedAt === undefined]).toEqual(["fixed", false]);
    await expect(editChatMessage(2, id, "mine now")).rejects.toThrow(/doesn't exist/);
    await ageChatMessage(id, 16);
    await expect(editChatMessage(1, id, "too late")).rejects.toThrow(/too late/);
    await expect(editChatMessage(1, id, " ")).rejects.toThrow(/Write a message/);
  });

  it("leaves a tombstone: the text and its mentions gone, the gap kept", async () => {
    const { id } = await say(1, "secret", [2]);
    await expect(deleteChatMessage(2, id)).rejects.toThrow(/doesn't exist/);
    const gone = await deleteChatMessage(1, id);
    expect([gone.body, gone.mentions, gone.deletedAt === undefined]).toEqual(["", [], false]);
    expect((await getChatMessages(2, "garden")).messages).toHaveLength(1);
    await expect(editChatMessage(1, id, "back")).rejects.toThrow(/doesn't exist/);
    await expect(deleteChatMessage(1, id)).rejects.toThrow(/doesn't exist/);
  });

  it("can't be edited while the circle is deciding whether to remove it, and a delete ends that", async () => {
    const { id } = await say(1, "contested");
    const proposal = await proposeChatRemoval(2, id);
    expect((await getChatMessages(3, "garden")).messages[0]?.reviewProposalId).toBe(proposal.id);
    await expect(editChatMessage(1, id, "changed")).rejects.toThrow(/deciding whether to remove/);
    await deleteChatMessage(1, id);
    const [message] = (await getChatMessages(3, "garden")).messages;
    expect(message?.reviewProposalId).toBeUndefined();
  });
});

describe("unread counts", () => {
  it("counts others' messages after where the member read to, not their own or deleted ones", async () => {
    const a = await say(2, "one");
    await say(2, "two");
    const c = await say(3, "three");
    await say(1, "mine");
    await deleteChatMessage(3, c.id);
    expect(await getChatUnread(1)).toEqual({ garden: 2 });
    expect(await getChatUnread(4)).toEqual({});
    await markChatRead(1, "garden", a.id);
    expect(await getChatUnread(1)).toEqual({ garden: 1 });
  });

  it("never moves read-to backwards, nor past the newest message", async () => {
    const a = await say(2, "one");
    const b = await say(2, "two");
    await markChatRead(1, "garden", b.id);
    await markChatRead(1, "garden", a.id);
    expect(await getChatUnread(1)).toEqual({});
    await markChatRead(1, "garden", b.id + 1000);
    const later = await say(2, "three");
    expect(later.id).toBeLessThan(b.id + 1000);
    expect(await getChatUnread(1)).toEqual({ garden: 1 });
  });

  it("refuses a non-member and a nonsense place", async () => {
    await say(2, "one");
    await expect(markChatRead(4, "garden", 1)).rejects.toThrow();
    await expect(markChatRead(1, "garden", 0)).rejects.toThrow(/place in the thread/);
  });
});

describe("who's told of a message", () => {
  it("tells the whole circle but the author, or only those tagged", async () => {
    const plain = await say(1, "to all");
    expect((await getChatNoticeData(plain.id))?.recipientIds.sort()).toEqual([2, 3]);
    const tagged = await say(1, "to you", [3]);
    expect((await getChatNoticeData(tagged.id))?.recipientIds).toEqual([3]);
  });

  it("has nothing for a message deleted since, or one that doesn't exist", async () => {
    const { id } = await say(1);
    await deleteChatMessage(1, id);
    expect(await getChatNoticeData(id)).toBeNull();
    expect(await getChatNoticeData(9999)).toBeNull();
  });
});
