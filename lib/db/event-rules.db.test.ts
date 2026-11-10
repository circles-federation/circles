import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EventDetails, EventDraft } from "@/lib/events.util";
import { cancelEvent, createEvent, getEvent, getVisibleEvent, setRsvp, toggleRoleSlot, updateEventDetails } from "./events";
import { addCircle, addMember, eventNotices, join, resetDb } from "./testing";

const NOW = new Date("2026-11-05T12:00:00-05:00");

const draft = (over: Partial<EventDraft> = {}): EventDraft => ({
  title: "Potluck",
  kind: "ordinary",
  circleId: "the903",
  date: "2026-11-10",
  start: "18:00",
  end: "20:00",
  location: "The yard",
  description: "Bring a dish",
  ...over,
});

const details = (over: Partial<EventDetails> = {}): EventDetails => ({
  title: "Potluck",
  date: "2026-11-10",
  start: "18:00",
  end: "20:00",
  location: "The yard",
  description: "Bring a dish",
  roles: [],
  reminders: [24],
  ...over,
});

async function make(memberId: number, over: Partial<EventDraft> = {}) {
  const { events, proposalId } = await createEvent(memberId, draft(over));
  return { event: events[0]!, events, proposalId };
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  await resetDb();
  for (const id of [1, 2, 3, 4, 5]) await addMember(id);
  await addCircle("city", { type: "other" });
  await addCircle("the903", { type: "neighborhood", parentId: "city" });
  await addCircle("council", { type: "circle", parentId: "the903" });
  await addCircle("club", { type: "group", parentId: "city" });
  await addCircle("solo", { type: "cooperative", parentId: "the903" });
  await join("the903", 1, 2, 3);
  await join("council", 1, 2);
  await join("club", 1, 5);
  await join("solo", 3);
});

afterEach(() => vi.useRealTimers());

describe("creating an event", () => {
  it("makes the creator the organizer and an attendee, and tells the rest of the circle", async () => {
    const { event, proposalId } = await make(1);
    expect(proposalId).toBeUndefined();
    expect(event.organizerId).toBe(1);
    expect(event.rsvps).toEqual([1]);
    expect(event.proposed).toBeFalsy();
    // the neighborhood has sub-circles, so they hear in the digest, not by their own email
    expect(await eventNotices(event.id, "new")).toEqual([2, 3]);
  });

  it("refuses a circle they don't belong to, a past date, and a start that's passed", async () => {
    await expect(createEvent(4, draft())).rejects.toThrow(/only post to circles you belong to/);
    await expect(createEvent(1, draft({ date: "2026-11-04" }))).rejects.toBeTruthy();
    await expect(createEvent(1, draft({ date: "2026-11-05", start: "08:00", end: "09:00" }))).rejects.toBeTruthy();
  });

  it("can post to the city, which everyone is in", async () => {
    const { event } = await make(4, { circleId: "city" });
    expect((await getVisibleEvent(5, event.id))?.id).toBe(event.id);
  });

  it("refuses a meeting in the city or in a group", async () => {
    const meeting = { kind: "meeting" as const, description: "", agenda: [{ title: "Hi", category: "report" as const }] };
    await expect(createEvent(1, draft({ ...meeting, circleId: "city" }))).rejects.toThrow(/own members/);
    await expect(createEvent(1, draft({ ...meeting, circleId: "club" }))).rejects.toThrow(/hasn't turned on meetings/);
  });

  it("refuses hosting for a circle they're not in, for the whole city, or a group's event shown elsewhere", async () => {
    await expect(createEvent(3, draft({ hostCircleId: "council" }))).rejects.toThrow(/belong to/);
    await expect(createEvent(1, draft({ hostCircleId: "city", circleId: "city" }))).rejects.toThrow(/whole city can't host/);
    await expect(createEvent(1, draft({ hostCircleId: "club", circleId: "the903" }))).rejects.toThrow(/shown only to the group/);
  });

  it("starts an event a circle hosts as a proposal only that circle sees", async () => {
    const { event, proposalId } = await make(1, { hostCircleId: "council" });
    expect(proposalId).toBeTruthy();
    expect(event.proposed).toBe(true);
    expect(await getVisibleEvent(2, event.id)).not.toBeNull();
    expect(await getVisibleEvent(3, event.id)).toBeNull();
  });

  it("makes a circle of one's hosted event live at once", async () => {
    const { event } = await make(3, { hostCircleId: "solo" });
    expect(event.proposed).toBeFalsy();
    expect((await getVisibleEvent(2, event.id))?.hostCircleId).toBe("solo");
  });

  it("adds a weekly series' dates a few weeks ahead, notifying once", async () => {
    const { events } = await make(1, { repeat: { frequency: "weekly" } });
    expect(events.map((e) => e.date)).toEqual(["2026-11-10", "2026-11-17", "2026-11-24", "2026-12-01"]);
    const notified = await Promise.all(events.map((e) => eventNotices(e.id, "new")));
    expect(notified.map((n) => n.length)).toEqual([2, 0, 0, 0]);
  });
});

describe("RSVPs", () => {
  it("toggles going, and a member outside its audience can't find it", async () => {
    const { event } = await make(1);
    expect((await setRsvp(2, event.id, true)).rsvps.sort()).toEqual([1, 2]);
    expect((await setRsvp(2, event.id, true)).rsvps.sort()).toEqual([1, 2]);
    expect((await setRsvp(2, event.id, false)).rsvps).toEqual([1]);
    await expect(setRsvp(4, event.id, true)).rejects.toThrow(/doesn't exist/);
  });

  it("is closed once the event is over", async () => {
    const { event } = await make(1);
    vi.setSystemTime(new Date("2026-11-10T21:00:00-05:00"));
    await expect(setRsvp(2, event.id, true)).rejects.toThrow(/over/);
  });

  it("is closed while it waits for consent, and for an event with signup roles", async () => {
    const proposed = await make(1, { hostCircleId: "council" });
    await expect(setRsvp(2, proposed.event.id, true)).rejects.toThrow(/waiting on its circle's consent/);
    const slotted = await make(1, { roles: [{ label: "Cook", min: 1 }] });
    await expect(setRsvp(2, slotted.event.id, true)).rejects.toThrow(/signup roles/);
  });
});

describe("signup roles", () => {
  const roles = [
    { label: "Cook", min: 1, max: 1 },
    { label: "Cleaner", min: 0 },
  ];

  it("holds a person to one role at a time, and a role to its maximum", async () => {
    const { event } = await make(1, { roles });
    const taken = await toggleRoleSlot(2, event.id, "cook");
    expect(taken.roles?.find((r) => r.key === "cook")?.members).toEqual([2]);
    await expect(toggleRoleSlot(3, event.id, "cook")).rejects.toThrow(/full/);
    const moved = await toggleRoleSlot(2, event.id, "cleaner");
    expect(moved.roles?.find((r) => r.key === "cook")?.members).toEqual([]);
    expect(moved.roles?.find((r) => r.key === "cleaner")?.members).toEqual([2]);
    const left = await toggleRoleSlot(2, event.id, "cleaner");
    expect(left.roles?.find((r) => r.key === "cleaner")?.members).toEqual([]);
    await expect(toggleRoleSlot(2, event.id, "nope")).rejects.toThrow(/doesn't exist/);
  });
});

describe("editing", () => {
  it("is the organizer's alone for a person's event", async () => {
    const { event } = await make(1);
    await expect(updateEventDetails(2, event.id, details({ title: "Mine" }))).rejects.toThrow(/Only the person hosting/);
    const [updated] = await updateEventDetails(1, event.id, details({ title: "Potluck 2" }));
    expect(updated?.title).toBe("Potluck 2");
  });

  it("is any member's of the circle holding it", async () => {
    const { event } = await make(3, { hostCircleId: "solo" });
    await join("solo", 2);
    const [updated] = await updateEventDetails(2, event.id, details({ location: "Elsewhere" }));
    expect(updated?.location).toBe("Elsewhere");
  });

  it("refuses an event that's happened, one waiting on consent, and a cancelled one", async () => {
    const { event } = await make(1);
    const proposed = await make(1, { hostCircleId: "council" });
    await expect(updateEventDetails(1, proposed.event.id, details())).rejects.toThrow(/waiting on its group's consent/);
    await setRsvp(2, event.id, true);
    await cancelEvent(1, event.id);
    await expect(updateEventDetails(1, event.id, details())).rejects.toThrow(/cancelled/);
    const later = await make(1);
    vi.setSystemTime(new Date("2026-11-12T12:00:00-05:00"));
    await expect(updateEventDetails(1, later.event.id, details())).rejects.toThrow(/already happened/);
  });

  it("keeps people signed up to a role whose name is unchanged", async () => {
    const { event } = await make(1, { roles: [{ label: "Cook", min: 1 }] });
    await toggleRoleSlot(2, event.id, "cook");
    await updateEventDetails(1, event.id, details({ roles: [{ label: "Cook", min: 1 }, { label: "DJ", min: 0 }] }));
    const after = await getEvent(event.id);
    expect(after?.roles?.find((r) => r.key === "cook")?.members).toEqual([2]);
    expect(after?.roles?.map((r) => r.key)).toEqual(["cook", "dj"]);
  });

  it("tells those going when the time or place changes, but not for other edits", async () => {
    const { event } = await make(1);
    await setRsvp(2, event.id, true);
    await updateEventDetails(1, event.id, details({ title: "Renamed" }));
    expect(await eventNotices(event.id, "updated")).toEqual([]);
    await updateEventDetails(1, event.id, details({ location: "The porch" }));
    expect(await eventNotices(event.id, "updated")).toEqual([2]);
  });
});

describe("cancelling", () => {
  it("deletes an event no one else is going to", async () => {
    const { event } = await make(1);
    const result = await cancelEvent(1, event.id);
    expect(result.deletedIds).toEqual([event.id]);
    expect(await getEvent(event.id)).toBeNull();
  });

  it("keeps one others are going to as cancelled, telling them, and closes it", async () => {
    const { event } = await make(1);
    await setRsvp(2, event.id, true);
    const result = await cancelEvent(1, event.id);
    expect(result.deletedIds).toEqual([]);
    expect(result.events[0]?.cancelled).toBe(true);
    expect(await eventNotices(event.id, "cancelled")).toEqual([2]);
    await expect(setRsvp(3, event.id, true)).rejects.toThrow(/cancelled/);
    await expect(cancelEvent(1, event.id)).rejects.toThrow(/cancelled/);
  });

  it("withdraws a proposed event's proposal, even after its date", async () => {
    const { event, proposalId } = await make(1, { hostCircleId: "council" });
    const result = await cancelEvent(2, event.id);
    expect(result.withdrawnProposalId).toBe(proposalId);
    expect(await getEvent(event.id)).toBeNull();
  });

  it("is for the organizer, or a member of the circle holding it", async () => {
    const { event } = await make(1);
    await expect(cancelEvent(2, event.id)).rejects.toThrow(/Only the person hosting/);
    const hosted = await make(3, { hostCircleId: "solo" });
    await join("solo", 2);
    await expect(cancelEvent(2, hosted.event.id)).resolves.toBeTruthy();
  });

  it("refuses one that's already happened", async () => {
    const { event } = await make(1);
    vi.setSystemTime(new Date("2026-11-12T12:00:00-05:00"));
    await expect(cancelEvent(1, event.id)).rejects.toThrow(/already happened/);
  });

  it("ends a series from this date on with scope upcoming, leaving earlier dates", async () => {
    const { events } = await make(1, { repeat: { frequency: "weekly" } });
    const result = await cancelEvent(1, events[1]!.id, "upcoming");
    expect(result.events.map((e) => e.date)).toEqual(["2026-11-10"]);
  });
});
