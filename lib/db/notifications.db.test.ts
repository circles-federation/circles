import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EventDetails, EventDraft } from "@/lib/events.util";
import { cancelEvent, checkUnfilledSlots, createEvent, getEvent, setRsvp, toggleRoleSlot, updateEventDetails } from "./events";
import { claimEventNotifications, enqueueReminders, markNotificationSent } from "./notifications";
import { respondToProposal } from "./proposals";
import { addCircle, addMember, ageNotice, enablePush, giveRole, join, noticeRows, queueOf, resetDb, setNotify } from "./testing";

const NOW = new Date("2026-11-05T12:00:00-05:00");
const at = (iso: string) => new Date(`${iso}-05:00`);

const draft = (over: Partial<EventDraft> = {}): EventDraft => ({
  title: "Potluck",
  kind: "ordinary",
  circleId: "coop",
  date: "2026-11-10",
  start: "18:00",
  end: "20:00",
  location: "The yard",
  description: "",
  ...over,
});

const details = (over: Partial<EventDetails> = {}): EventDetails => ({
  title: "Potluck",
  date: "2026-11-10",
  start: "18:00",
  end: "20:00",
  location: "The yard",
  description: "",
  roles: [],
  reminders: [24],
  ...over,
});

const make = async (memberId: number, over: Partial<EventDraft> = {}) => (await createEvent(memberId, draft(over))).events[0]!;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  await resetDb();
  for (const id of [1, 2, 3, 4, 5]) await addMember(id);
  await addCircle("city", { type: "other" });
  // a neighborhood has sub-circles, so what it's told goes in the digest
  await addCircle("the903", { type: "neighborhood", parentId: "city" });
  await addCircle("council", { type: "circle", parentId: "the903" });
  await addCircle("coop", { type: "cooperative", parentId: "city" });
  await join("the903", 1, 2, 3, 4);
  await join("council", 1, 2);
  await join("coop", 1, 2, 3);
});

afterEach(() => vi.useRealTimers());

describe("who is told of a new event, and how", () => {
  it("emails a circle with no sub-circles at once, except the creator", async () => {
    const e = await make(1);
    expect(await queueOf(e.id)).toEqual(["new:2:email", "new:3:email"]);
  });

  it("puts a big circle's members in the digest, by email only, even with push on", async () => {
    await enablePush(2);
    const e = await make(1, { circleId: "the903" });
    expect(await queueOf(e.id)).toEqual(["new:2:email:digest", "new:3:email:digest", "new:4:email:digest"]);
  });

  it("tells everyone of a city event, members of no circle included, in the digest", async () => {
    const e = await make(1, { circleId: "city" });
    expect(await queueOf(e.id)).toEqual(["new:2:email:digest", "new:3:email:digest", "new:4:email:digest", "new:5:email:digest"]);
  });

  it("uses every channel a member can be reached on, and respects what they've turned off", async () => {
    await enablePush(2);
    await enablePush(3);
    await setNotify(3, { push: false });
    await setNotify(2, { email: false });
    await setNotify(3, { address: null });
    const e = await make(1);
    // 2: push only (email off); 3: neither (no address, push off)
    expect(await queueOf(e.id)).toEqual(["new:2:push"]);
  });
});

describe("delivery", () => {
  it("claims due rows once, leasing them, and again only after the retry delay", async () => {
    const e = await make(1);
    const first = await claimEventNotifications(10, "email");
    expect(first.map((n) => n.memberId).sort()).toEqual([2, 3]);
    expect(first[0]).toMatchObject({ notice: "new", title: "Potluck", start: "18:00", circleName: "coop" });
    expect(await claimEventNotifications(10, "email")).toEqual([]);
    await ageNotice(e.id, 2, "new", { lastAttemptMinutesAgo: 6 });
    expect((await claimEventNotifications(10, "email")).map((n) => n.memberId)).toEqual([2]);
  });

  it("stops retrying after five attempts, and never resends one that went", async () => {
    const e = await make(1);
    await ageNotice(e.id, 2, "new", { attempts: 5 });
    const claimed = await claimEventNotifications(10, "email");
    expect(claimed.map((n) => n.memberId)).toEqual([3]);
    await markNotificationSent({ eventId: e.id, memberId: 3, notice: "new", channel: "email" });
    await ageNotice(e.id, 3, "new", { lastAttemptMinutesAgo: 60 });
    expect(await claimEventNotifications(10, "email")).toEqual([]);
  });

  it("claims one channel at a time and leaves digest lines for the digest", async () => {
    await enablePush(2);
    await make(1);
    const big = await make(1, { circleId: "the903" });
    expect((await claimEventNotifications(10, "push")).map((n) => n.memberId)).toEqual([2]);
    const emails = await claimEventNotifications(10, "email");
    expect(emails.some((n) => n.eventId === big.id)).toBe(false);
  });

  it("drops an email row for someone who has since turned email off or lost their address", async () => {
    await make(1);
    await setNotify(2, { email: false });
    await setNotify(3, { address: null });
    const claimed = await claimEventNotifications(10, "email");
    expect(claimed.map((n) => [n.memberId, n.email])).toEqual(expect.arrayContaining([[2, null], [3, null]]));
  });
});

describe("what changes tell people going", () => {
  it("emails a new time or place, but a pending notice keeps the older 'was'", async () => {
    const e = await make(1);
    await setRsvp(2, e.id, true);
    await updateEventDetails(1, e.id, details({ location: "The porch" }));
    await updateEventDetails(1, e.id, details({ location: "The roof" }));
    const [row] = await noticeRows(e.id, 2, "updated");
    expect(row?.change).toMatchObject({ was: { location: "The yard" } });
    expect(row?.attempts).toBe(0);
  });

  it("makes a later edit news again once the earlier notice was sent", async () => {
    const e = await make(1);
    await setRsvp(2, e.id, true);
    await updateEventDetails(1, e.id, details({ location: "The porch" }));
    await markNotificationSent({ eventId: e.id, memberId: 2, notice: "updated", channel: "email" });
    await updateEventDetails(1, e.id, details({ location: "The roof" }));
    const [row] = await noticeRows(e.id, 2, "updated");
    expect(row?.sent_at).toBeNull();
    expect(row?.change).toMatchObject({ was: { location: "The porch" } });
  });

  it("withdraws what's unsent about an event when it's cancelled, and tells those going", async () => {
    const e = await make(1);
    await setRsvp(2, e.id, true);
    await cancelEvent(1, e.id);
    expect(await queueOf(e.id)).toEqual(["cancelled:2:email"]);
  });
});

describe("reminders", () => {
  it("queues a day-before reminder for everyone going once the event is within a day, once", async () => {
    const e = await make(1);
    await setRsvp(2, e.id, true);
    expect(await enqueueReminders(at("2026-11-09T17:00"))).toBe(0);
    expect(await enqueueReminders(at("2026-11-09T19:00"))).toBe(2);
    expect(await queueOf(e.id)).toEqual(expect.arrayContaining(["reminder:1:email", "reminder:2:email"]));
    expect(await enqueueReminders(at("2026-11-09T20:00"))).toBe(0);
  });

  it("only sends the reminders its organizer chose", async () => {
    const e = await make(1, { reminders: [1] });
    expect(await enqueueReminders(at("2026-11-09T19:00"))).toBe(0);
    expect(await enqueueReminders(at("2026-11-10T17:30"))).toBe(1);
    expect(await queueOf(e.id)).toEqual(["new:2:email", "new:3:email", "reminder_1h:1:email"]);
  });

  it("skips a cancelled event and one still waiting on consent", async () => {
    const cancelled = await make(1);
    await setRsvp(2, cancelled.id, true);
    await cancelEvent(1, cancelled.id);
    await createEvent(1, draft({ circleId: "the903", hostCircleId: "council" }));
    expect(await enqueueReminders(at("2026-11-09T19:00"))).toBe(0);
  });

  it("queues a reminder due again after the event is moved", async () => {
    const e = await make(1);
    expect(await enqueueReminders(at("2026-11-09T19:00"))).toBe(1);
    await updateEventDetails(1, e.id, details({ start: "19:00", end: "21:00" }));
    // the unsent one named the old time and went; the new time's own is due when it comes in range
    expect(await queueOf(e.id)).not.toContain("reminder:1:email");
    expect(await enqueueReminders(at("2026-11-09T19:30"))).toBe(1);
    expect(await queueOf(e.id)).toContain("reminder:1:email");
  });
});

describe("a required role that's still short", () => {
  const roles = [{ label: "Cook", min: 1 }];

  it("warns its host an hour before, once, and doesn't cancel it yet", async () => {
    const e = await make(1, { roles });
    expect(await checkUnfilledSlots(at("2026-11-10T16:30"))).toEqual([]);
    expect(await queueOf(e.id)).not.toContain("short:1:email");
    expect(await checkUnfilledSlots(at("2026-11-10T17:30"))).toEqual([]);
    expect(await queueOf(e.id)).toContain("short:1:email");
    await markNotificationSent({ eventId: e.id, memberId: 1, notice: "short", channel: "email" });
    await checkUnfilledSlots(at("2026-11-10T17:40"));
    expect((await noticeRows(e.id, 1, "short"))[0]?.sent_at).not.toBeNull();
    expect((await getEvent(e.id))?.cancelled).toBeFalsy();
  });

  it("cancels it automatically 15 minutes before, telling those going and its host", async () => {
    const e = await make(1, { roles: [{ label: "Cook", min: 1 }, { label: "Cleaner", min: 0 }] });
    await toggleRoleSlot(2, e.id, "cleaner");
    expect(await checkUnfilledSlots(at("2026-11-10T17:50"))).toEqual([e.id]);
    const after = await getEvent(e.id);
    expect(after?.cancelled).toBe(true);
    expect(after?.cancelledAutomatically).toBe(true);
    expect(await queueOf(e.id)).toEqual(["cancelled:1:email", "cancelled:2:email"]);
  });

  it("runs once every required role is filled by then, and stays on even if someone drops out", async () => {
    const e = await make(1, { roles });
    await toggleRoleSlot(2, e.id, "cook");
    expect(await checkUnfilledSlots(at("2026-11-10T17:50"))).toEqual([]);
    await toggleRoleSlot(2, e.id, "cook");
    expect(await checkUnfilledSlots(at("2026-11-10T17:55"))).toEqual([]);
    const after = await getEvent(e.id);
    expect(after?.cancelled).toBeFalsy();
    expect(after?.noAutoCancel).toBe(true);
  });

  it("warns, but never cancels, an event made to start within the hour", async () => {
    vi.setSystemTime(at("2026-11-10T17:20"));
    const e = await make(1, { roles });
    expect((await getEvent(e.id))?.noAutoCancel).toBe(true);
    await checkUnfilledSlots(at("2026-11-10T17:25"));
    expect(await checkUnfilledSlots(at("2026-11-10T17:50"))).toEqual([]);
    expect(await queueOf(e.id)).toContain("short:1:email");
  });

  describe("for an event a circle hosts", () => {
    async function hosted() {
      await join("council", 5);
      const { events, proposalId } = await createEvent(1, draft({ circleId: "the903", hostCircleId: "council", roles }));
      await respondToProposal(2, proposalId!, "like");
      await respondToProposal(5, proposalId!, "like");
      return events[0]!;
    }
    const warned = async (id: string) => (await queueOf(id)).filter((q) => q.startsWith("short:")).map((q) => q.split(":")[1]);

    it("tells every member of the host circle when no one holds a role there", async () => {
      const e = await hosted();
      await checkUnfilledSlots(at("2026-11-10T17:30"));
      expect(await warned(e.id)).toEqual(["1", "2", "5"]);
    });

    it("tells its role-holders and the organizer once some are assigned, not everyone", async () => {
      await giveRole("council", "Secretary", 2);
      const e = await hosted();
      await checkUnfilledSlots(at("2026-11-10T17:30"));
      expect(await warned(e.id)).toEqual(["1", "2"]);
    });
  });
});
