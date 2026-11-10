import { beforeEach, describe, expect, it } from "vitest";
import { leaveCircle } from "./circles";
import { assignMessage, getMessageNoticeData, getMessagesForMember, markMessageRead, sendMessage, setMessageDone } from "./messages";
import { addCircle, addMember, join, resetDb, setInbox, setNotify } from "./testing";

const note = (over: Partial<{ subject: string; body: string; consent: boolean }> = {}) => ({ subject: "Hello", body: "Can we borrow the hall?", consent: true, ...over });

beforeEach(async () => {
  await resetDb();
  for (const id of [1, 2, 3, 4]) await addMember(id);
  await addCircle("city", { type: "other" });
  await addCircle("the903", { type: "neighborhood", parentId: "city" });
  await join("the903", 1, 2, 3, 4);
  await addCircle("garden", { type: "circle", parentId: "the903", name: "Garden" });
  await join("garden", 1, 2);
  await setInbox("garden", true);
});

describe("writing to a circle", () => {
  it("lets anyone signed in write to a circle with its Inbox on", async () => {
    const { id } = await sendMessage(3, "garden", note({ subject: "  Hello  " }));
    const [message] = await getMessagesForMember(1);
    expect(message).toMatchObject({ id, senderId: 3, senderName: "Member 3", replyEmail: "m3@example.test", subject: "Hello", read: false });
  });

  it("refuses a circle whose Inbox is off, one that can't have one, and one that's gone", async () => {
    await setInbox("garden", false);
    await expect(sendMessage(3, "garden", note())).rejects.toThrow(/isn't taking messages/);
    await expect(sendMessage(3, "the903", note())).rejects.toThrow(/isn't taking messages/);
    await expect(sendMessage(3, "nope", note())).rejects.toThrow(/isn't taking messages/);
  });

  it("refuses an invalid message, and a sender with no address to answer", async () => {
    await expect(sendMessage(3, "garden", note({ subject: "" }))).rejects.toThrow(/subject/);
    await expect(sendMessage(3, "garden", note({ consent: false }))).rejects.toThrow(/replied to by email/);
    await setNotify(3, { address: null });
    await expect(sendMessage(3, "garden", note())).rejects.toThrow(/no email address/);
  });

  it("allows five an hour from one sender, across circles", async () => {
    await addCircle("co-op", { type: "cooperative", parentId: "the903" });
    await join("co-op", 1);
    await setInbox("co-op", true);
    for (let i = 0; i < 3; i++) await sendMessage(3, "garden", note());
    for (let i = 0; i < 2; i++) await sendMessage(3, "co-op", note());
    await expect(sendMessage(3, "garden", note())).rejects.toThrow(/a lot of messages/);
    await expect(sendMessage(4, "garden", note())).resolves.toBeDefined();
  });
});

describe("who reads the Inbox", () => {
  it("sends a circle's messages to its members alone", async () => {
    const { id } = await sendMessage(3, "garden", note());
    expect((await getMessagesForMember(2)).map((m) => m.id)).toEqual([id]);
    expect(await getMessagesForMember(4)).toEqual([]);
    expect(await getMessagesForMember(3)).toEqual([]);
  });

  it("sends none once the Inbox is off", async () => {
    await sendMessage(3, "garden", note());
    await setInbox("garden", false);
    expect(await getMessagesForMember(1)).toEqual([]);
  });

  it("treats a message as not existing to anyone outside the circle", async () => {
    const { id } = await sendMessage(3, "garden", note());
    for (const run of [() => markMessageRead(4, id), () => assignMessage(4, id, 4), () => setMessageDone(4, id, true), () => markMessageRead(3, id)]) await expect(run()).rejects.toThrow(/doesn't exist/);
    await expect(markMessageRead(1, "nope")).rejects.toThrow(/doesn't exist/);
  });
});

describe("handling a message", () => {
  it("is read per member, once", async () => {
    const { id } = await sendMessage(3, "garden", note());
    expect((await markMessageRead(1, id)).read).toBe(true);
    expect((await markMessageRead(1, id)).read).toBe(true);
    expect((await getMessagesForMember(1))[0]?.read).toBe(true);
    expect((await getMessagesForMember(2))[0]?.read).toBe(false);
  });

  it("is handled by a member of the circle, or no one", async () => {
    const { id } = await sendMessage(3, "garden", note());
    expect((await assignMessage(1, id, 2)).assigneeId).toBe(2);
    await expect(assignMessage(1, id, 4)).rejects.toThrow(/Only a member/);
    expect((await assignMessage(1, id, null)).assigneeId).toBeUndefined();
  });

  it("is filed as done and brought back", async () => {
    const { id } = await sendMessage(3, "garden", note());
    expect((await setMessageDone(1, id, true)).doneAt).toBeDefined();
    expect((await setMessageDone(2, id, false)).doneAt).toBeUndefined();
  });

  it("is let go by a member who leaves the circle", async () => {
    const { id } = await sendMessage(3, "garden", note());
    await assignMessage(1, id, 2);
    await leaveCircle(2, "garden");
    expect((await getMessagesForMember(1))[0]?.assigneeId).toBeUndefined();
  });
});

describe("telling the circle", () => {
  it("lists every member but the sender, with an address only for those taking email", async () => {
    await setNotify(2, { email: false });
    const { id } = await sendMessage(1, "garden", note());
    const notice = await getMessageNoticeData(id);
    expect(notice).toMatchObject({ circleName: "Garden", senderName: "Member 1", subject: "Hello" });
    expect(notice?.recipients).toEqual([{ memberId: 2, name: "Member 2" }]);
    expect(await getMessageNoticeData("nope")).toBeNull();
  });
});
