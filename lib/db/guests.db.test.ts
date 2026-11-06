import { beforeEach, describe, expect, it } from "vitest";
import { addDays, localDay } from "@/lib/recurrence.util";
import type { EventDraft } from "@/lib/events.util";
import { cancelEvent, createEvent, setRsvp } from "./events";
import { claimGuestNotifications } from "./guest-notifications";
import {
  cancelGuestRsvp,
  confirmGuestRsvp,
  confirmedGuestNames,
  findGuestRsvp,
  getGuestForStopPage,
  getVerifiedGuest,
  purgeGuestData,
  renewGuestCode,
  startGuestRsvp,
  stopGuestEmails,
  takeCodeAllowance,
} from "./guest-rsvps";
import { confirmGuestMessage, GUEST_MESSAGES_PER_DAY, purgeGuestMessageDrafts, renewGuestMessageCode, startGuestMessage } from "./guest-messages";
import { getMessagesForMember } from "./messages";
import { getOrCreateShareToken, getSharedEvent, getShareStatus, revokeShareLinks } from "./event-shares";
import {
  addCircle,
  addMember,
  ageGuestCode,
  backdate,
  codeRequestCount,
  guestMessageDraftCount,
  guestNoticeKinds,
  guestRsvpCount,
  guestRsvpRow,
  join,
  resetDb,
  setInbox,
} from "./testing";

// these use the real clock (the code windows are checked against the database's
// own), so the event is a while ahead of today
const eventDay = addDays(localDay(), 10);

const draft = (over: Partial<EventDraft> = {}): EventDraft => ({
  title: "Block party",
  kind: "ordinary",
  circleId: "city",
  date: eventDay,
  start: "14:00",
  end: "17:00",
  location: "The street",
  description: "Bring chairs",
  ...over,
});

const make = async (memberId = 1, over: Partial<EventDraft> = {}) => (await createEvent(memberId, draft(over))).events[0]!;

beforeEach(async () => {
  await resetDb();
  for (const id of [1, 2, 3]) await addMember(id);
  await addCircle("city", { type: "other" });
  await addCircle("the903", { type: "neighborhood", parentId: "city" });
  await addCircle("club", { type: "group", parentId: "city", name: "Book Club" });
  await addCircle("council", { type: "circle", parentId: "the903", name: "Council" });
  await join("the903", 1, 2);
  await join("club", 1);
  await join("council", 1, 2);
});

describe("sharing an event", () => {
  it("gives a member one live link per event, the same one each time", async () => {
    const e = await make();
    const a = await getOrCreateShareToken(1, e.id);
    expect(await getOrCreateShareToken(1, e.id)).toBe(a);
    expect(await getOrCreateShareToken(2, e.id)).not.toBe(a);
  });

  it("refuses what can't be shared: not visible, a meeting, undecided, cancelled", async () => {
    const group = await make(1, { circleId: "club" });
    await expect(getOrCreateShareToken(2, group.id)).rejects.toThrow(/doesn't exist/);
    const meeting = (await createEvent(1, draft({ circleId: "council", kind: "meeting", description: "", agenda: [{ title: "Hi", category: "report" }] }))).events[0]!;
    await expect(getOrCreateShareToken(1, meeting.id)).rejects.toThrow(/meeting can't be shared|consented/);
    const proposed = await make(1, { circleId: "the903", hostCircleId: "council" });
    await expect(getOrCreateShareToken(1, proposed.id)).rejects.toThrow(/consented/);
    const cancelled = await make();
    await setRsvp(2, cancelled.id, true);
    await cancelEvent(1, cancelled.id);
    await expect(getOrCreateShareToken(1, cancelled.id)).rejects.toThrow(/cancelled/);
  });

  it("shows a stranger only the public page: first names, circle names, no ids", async () => {
    const e = await make(1, { circleId: "the903" });
    await setRsvp(2, e.id, true);
    const token = await getOrCreateShareToken(1, e.id);
    const shared = await getSharedEvent(token);
    expect(shared).toMatchObject({ title: "Block party", circleName: "the903", hostName: "Member 1", sharedBy: "Member 1", hasRoles: false, cancelled: false, ended: false });
    expect(shared?.going.sort()).toEqual(["Member 1", "Member 2"]);
    expect(Object.keys(shared!)).not.toContain("organizerId");
    expect(await getSharedEvent("nope")).toBeNull();
  });

  it("names the group on a group's event, which may be shared", async () => {
    const e = await make(1, { circleId: "club" });
    const shared = await getSharedEvent(await getOrCreateShareToken(1, e.id));
    expect(shared?.circleName).toBe("Book Club");
  });

  it("stops its own link, or every link for whoever manages the event, and mints a new one afterwards", async () => {
    const e = await make();
    const mine = await getOrCreateShareToken(1, e.id);
    const theirs = await getOrCreateShareToken(2, e.id);
    expect(await revokeShareLinks(2, e.id, "mine")).toBe(1);
    expect(await getSharedEvent(theirs)).toBeNull();
    expect(await getSharedEvent(mine)).not.toBeNull();
    await expect(revokeShareLinks(2, e.id, "all")).rejects.toThrow(/Only whoever manages/);
    expect((await getShareStatus(1, e.id)).canRevokeAll).toBe(true);
    expect(await revokeShareLinks(1, e.id, "all")).toBe(1);
    expect(await getSharedEvent(mine)).toBeNull();
    expect(await getOrCreateShareToken(1, e.id)).not.toBe(mine);
  });
});

describe("a guest's RSVP", () => {
  async function linked(over: Partial<EventDraft> = {}) {
    const e = await make(1, over);
    return { e, token: await getOrCreateShareToken(1, e.id) };
  }

  it("counts only once the emailed code is entered, then shows their first name", async () => {
    const { e, token } = await linked();
    const started = await startGuestRsvp(token, "Ona Park", "ona@example.test");
    expect(started).toMatchObject({ email: "ona@example.test", eventTitle: "Block party" });
    expect(started.code).toMatch(/^\d{6}$/);
    expect(await confirmedGuestNames(e.id)).toEqual([]);
    await confirmGuestRsvp(started.id, started.code);
    expect(await confirmedGuestNames(e.id)).toEqual(["Ona"]);
    expect((await getSharedEvent(token))?.going).toContain("Ona");
    expect(await guestNoticeKinds(started.id)).toEqual(["confirmed"]);
    // the code is used up
    await expect(confirmGuestRsvp(started.id, started.code)).rejects.toThrow(/already been used/);
  });

  it("refuses bad details, a member's address, and links or events that can't take one", async () => {
    const { e, token } = await linked();
    await expect(startGuestRsvp(token, "", "a@example.test")).rejects.toThrow(/name/);
    await expect(startGuestRsvp(token, "Ona", "not an email")).rejects.toThrow(/email/);
    await expect(startGuestRsvp(token, "Ona", "M1@example.test")).rejects.toThrow(/Sign in/);
    await expect(startGuestRsvp("nope", "Ona", "a@example.test")).rejects.toThrow(/doesn't lead to an event/);
    const slotted = await linked({ roles: [{ label: "Cook", min: 1 }] });
    await expect(startGuestRsvp(slotted.token, "Ona", "a@example.test")).rejects.toThrow(/roles/);
    await revokeShareLinks(1, e.id, "mine");
    await expect(startGuestRsvp(token, "Ona", "a@example.test")).rejects.toThrow(/doesn't lead to an event/);
  });

  it("locks after five wrong codes, even for the right one, until a new code is sent", async () => {
    const { token } = await linked();
    const s = await startGuestRsvp(token, "Ona", "ona@example.test");
    for (let i = 0; i < 5; i++) await expect(confirmGuestRsvp(s.id, "not the code")).rejects.toThrow(/doesn't match/);
    expect((await guestRsvpRow(s.id))?.attempts).toBe(5);
    await expect(confirmGuestRsvp(s.id, s.code)).rejects.toThrow(/Too many wrong codes/);
    await expect(renewGuestCode(s.id)).rejects.toThrow(/just sent/);
    await ageGuestCode("event_guest_rsvps", s.id, "cooldown-over");
    const fresh = await renewGuestCode(s.id);
    await confirmGuestRsvp(s.id, fresh.code);
    expect((await guestRsvpRow(s.id))?.confirmed).toBe(true);
  });

  it("refuses an expired code", async () => {
    const { token } = await linked();
    const s = await startGuestRsvp(token, "Ona", "ona@example.test");
    await ageGuestCode("event_guest_rsvps", s.id, "expired");
    await expect(confirmGuestRsvp(s.id, s.code)).rejects.toThrow(/expired/);
  });

  it("allows one code a minute per address, whatever its case, and keeps the first name given", async () => {
    const { token } = await linked();
    const s = await startGuestRsvp(token, "Ona", "ona@example.test");
    await expect(startGuestRsvp(token, "Ona", "ONA@example.test")).rejects.toThrow(/just sent/);
    await confirmGuestRsvp(s.id, s.code);
    await ageGuestCode("event_guest_rsvps", s.id, "cooldown-over");
    const again = await startGuestRsvp(token, "Someone Else", "ONA@example.test");
    expect(again.id).toBe(s.id);
    expect((await guestRsvpRow(s.id))?.name).toBe("Ona");
    expect(await guestRsvpCount()).toBe(1);
    // coming back with a code isn't news, and the RSVP stays confirmed
    await confirmGuestRsvp(again.id, again.code);
    expect(await guestNoticeKinds(s.id)).toEqual(["confirmed"]);
  });

  it("caps codes per event per hour and per connection per hour", async () => {
    const { token } = await linked();
    for (let i = 0; i < 50; i++) await startGuestRsvp(token, "Guest", `g${i}@example.test`);
    await expect(startGuestRsvp(token, "Guest", "late@example.test")).rejects.toThrow(/at once/);
    for (let i = 0; i < 10; i++) await takeCodeAllowance("hash-a");
    await expect(takeCodeAllowance("hash-a")).rejects.toThrow(/Too many codes/);
    await expect(takeCodeAllowance("hash-b")).resolves.toBeUndefined();
    expect(await codeRequestCount()).toBe(11);
  });

  it("lets only the browser holding its id find, take back, or apply from it", async () => {
    const { e, token } = await linked();
    const s = await startGuestRsvp(token, "Ona Park", "ona@example.test");
    expect(await findGuestRsvp([s.id], e.id)).toBeNull();
    await confirmGuestRsvp(s.id, s.code);
    expect(await findGuestRsvp([s.id], e.id)).toEqual({ id: s.id, name: "Ona Park" });
    expect(await findGuestRsvp(["someone-else"], e.id)).toBeNull();
    expect(await getVerifiedGuest([], s.id)).toBeNull();
    expect(await getVerifiedGuest([s.id], s.id)).toMatchObject({ email: "ona@example.test", invitedBy: 1 });
    await cancelGuestRsvp(s.id);
    expect(await confirmedGuestNames(e.id)).toEqual([]);
  });

  it("keeps guests on the list when a link is stopped", async () => {
    const { e, token } = await linked();
    const s = await startGuestRsvp(token, "Ona", "ona@example.test");
    await confirmGuestRsvp(s.id, s.code);
    await revokeShareLinks(1, e.id, "mine");
    expect(await confirmedGuestNames(e.id)).toEqual(["Ona"]);
  });
});

describe("what a guest is told", () => {
  async function going() {
    const e = await make();
    const token = await getOrCreateShareToken(1, e.id);
    const s = await startGuestRsvp(token, "Ona", "ona@example.test");
    await confirmGuestRsvp(s.id, s.code);
    return { e, s };
  }

  it("queues a confirmation, and a cancellation in its place, rather than deleting an event a guest is going to", async () => {
    const { e, s } = await going();
    expect(await guestNoticeKinds(s.id)).toEqual(["confirmed"]);
    const result = await cancelEvent(1, e.id);
    expect(result.deletedIds).toEqual([]);
    expect(result.events[0]?.cancelled).toBe(true);
    // an unsent confirmation would now be wrong, so only the cancellation goes
    expect(await guestNoticeKinds(s.id)).toEqual(["cancelled"]);
  });

  it("stops the emails, and drops the ones waiting, but keeps the RSVP", async () => {
    const { e, s } = await going();
    expect((await getGuestForStopPage(s.id))?.stopped).toBe(false);
    await stopGuestEmails(s.id);
    expect(await guestNoticeKinds(s.id)).toEqual([]);
    expect((await getGuestForStopPage(s.id))?.stopped).toBe(true);
    await cancelEvent(1, e.id);
    expect(await guestNoticeKinds(s.id)).toEqual([]);
    expect((await guestRsvpRow(s.id))?.confirmed).toBe(true);
  });

  it("claims a guest's due emails once", async () => {
    const { s } = await going();
    const first = await claimGuestNotifications(10);
    expect(first.map((n) => [n.guestId, n.notice, n.email])).toEqual([[s.id, "confirmed", "ona@example.test"]]);
    expect(await claimGuestNotifications(10)).toEqual([]);
  });
});

describe("purging guest data", () => {
  it("deletes an RSVP never confirmed after a day, and a guest's details 30 days after the event", async () => {
    const e = await make();
    const token = await getOrCreateShareToken(1, e.id);
    const stale = await startGuestRsvp(token, "Stale", "stale@example.test");
    const fresh = await startGuestRsvp(token, "Fresh", "fresh@example.test");
    const kept = await startGuestRsvp(token, "Kept", "kept@example.test");
    await confirmGuestRsvp(kept.id, kept.code);
    await backdate("event_guest_rsvps", stale.id, 2);
    expect(await purgeGuestData()).toBe(1);
    expect(await guestRsvpRow(stale.id)).toBeUndefined();
    expect(await guestRsvpRow(fresh.id)).toBeDefined();
    // 29 days after the event the confirmed guest is still kept (the unconfirmed
    // one, by then more than a day old, is not); at 31 they go too
    const soon = new Date(`${addDays(eventDay, 29)}T12:00:00`);
    const later = new Date(`${addDays(eventDay, 31)}T12:00:00`);
    expect(await purgeGuestData(soon)).toBe(1);
    expect(await guestRsvpRow(kept.id)).toBeDefined();
    expect(await purgeGuestData(later)).toBe(1);
    expect(await guestRsvpCount()).toBe(0);
  });

  it("deletes unconfirmed guest messages after a day", async () => {
    await setInbox("council");
    const s = await startGuestMessage("council", "Ona", "ona@example.test", { subject: "Hello", body: "Hi there", consent: true });
    await purgeGuestMessageDrafts();
    expect(await guestMessageDraftCount()).toBe(1);
    await backdate("guest_message_drafts", s.id, 2);
    await purgeGuestMessageDrafts();
    expect(await guestMessageDraftCount()).toBe(0);
  });
});

describe("a guest's message to a circle", () => {
  const message = { subject: "A question", body: "Is the hall open?", consent: true };

  beforeEach(async () => {
    await setInbox("council");
  });

  it("reaches the Inbox only once the code is entered, marked as from a guest, with the draft gone", async () => {
    const s = await startGuestMessage("council", "Ona Park", "ona@example.test", message);
    expect(await getMessagesForMember(1)).toEqual([]);
    const { messageId } = await confirmGuestMessage(s.id, s.code);
    const [msg] = await getMessagesForMember(1);
    expect(msg).toMatchObject({ id: messageId, subject: "A question", guest: true });
    expect(await guestMessageDraftCount()).toBe(0);
    await expect(confirmGuestMessage(s.id, s.code)).rejects.toThrow(/already been used/);
    // never to a non-member's Inbox
    expect(await getMessagesForMember(3)).toEqual([]);
  });

  it("refuses a circle that isn't taking messages, a member's address, and a bad message", async () => {
    await expect(startGuestMessage("the903", "Ona", "ona@example.test", message)).rejects.toThrow(/isn't taking messages/);
    await expect(startGuestMessage("nope", "Ona", "ona@example.test", message)).rejects.toThrow(/isn't taking messages/);
    await expect(startGuestMessage("council", "Ona", "m2@example.test", message)).rejects.toThrow(/Sign in/);
    await expect(startGuestMessage("council", "Ona", "ona@example.test", { subject: "", body: "x", consent: true })).rejects.toBeTruthy();
    await expect(startGuestMessage("council", "Ona", "ona@example.test", { ...message, consent: false })).rejects.toThrow(/Agree to be replied/);
    await setInbox("council", false);
    await expect(startGuestMessage("council", "Ona", "ona@example.test", message)).rejects.toThrow(/isn't taking messages/);
  });

  it("checks the code: wrong ones count, five lock it, expired fails, a new one works", async () => {
    const s = await startGuestMessage("council", "Ona", "ona@example.test", message);
    for (let i = 0; i < 5; i++) await expect(confirmGuestMessage(s.id, "nope")).rejects.toThrow(/doesn't match/);
    await expect(confirmGuestMessage(s.id, s.code)).rejects.toThrow(/Too many wrong codes/);
    await ageGuestCode("guest_message_drafts", s.id, "cooldown-over");
    const fresh = await renewGuestMessageCode(s.id);
    await ageGuestCode("guest_message_drafts", s.id, "expired");
    await expect(confirmGuestMessage(s.id, fresh.code)).rejects.toThrow(/expired/);
    await ageGuestCode("guest_message_drafts", s.id, "cooldown-over");
    const again = await renewGuestMessageCode(s.id);
    await expect(confirmGuestMessage(s.id, again.code)).resolves.toBeTruthy();
  });

  it("allows one code a minute per address", async () => {
    await startGuestMessage("council", "Ona", "ona@example.test", message);
    await expect(startGuestMessage("council", "Ona", "ONA@example.test", message)).rejects.toThrow(/just sent/);
  });

  it(`stops an address after ${GUEST_MESSAGES_PER_DAY} messages in a day, across circles`, async () => {
    await addCircle("other", { type: "collective", parentId: "the903" });
    await join("other", 1);
    await setInbox("other");
    for (let i = 0; i < GUEST_MESSAGES_PER_DAY; i++) {
      const s = await startGuestMessage(i % 2 ? "other" : "council", "Ona", "ona@example.test", message);
      await confirmGuestMessage(s.id, s.code);
      await ageGuestCode("guest_message_drafts", s.id, "cooldown-over");
    }
    await expect(startGuestMessage("council", "Ona", "Ona@Example.test", message)).rejects.toThrow(/3 messages a day/);
    await expect(startGuestMessage("council", "Pat", "pat@example.test", message)).resolves.toBeTruthy();
  });

  it("enforces the day's limit again when the code is entered", async () => {
    // four codes can be out at once, since nothing has been sent yet
    const drafts = [];
    for (let i = 0; i < GUEST_MESSAGES_PER_DAY + 1; i++) {
      const s = await startGuestMessage("council", "Ona", "ona@example.test", message);
      await ageGuestCode("guest_message_drafts", s.id, "cooldown-over");
      drafts.push(s);
    }
    for (const s of drafts.slice(0, GUEST_MESSAGES_PER_DAY)) await confirmGuestMessage(s.id, s.code);
    const last = drafts[GUEST_MESSAGES_PER_DAY]!;
    await expect(confirmGuestMessage(last.id, last.code)).rejects.toThrow(/3 messages a day/);
    expect(await getMessagesForMember(1)).toHaveLength(GUEST_MESSAGES_PER_DAY);
  });
});
