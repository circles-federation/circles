import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getMeetingAvailability } from "./availability";
import { db } from "./client";
import { insertEvent } from "./events";
import { events } from "./schema";
import { addCircle, addMember, join, resetDb } from "./testing";
import { event } from "@/lib/test/factories";

const DAY = "2099-01-05"; // a Monday

beforeEach(async () => {
  await resetDb();
  for (const id of [1, 2, 3]) await addMember(id);
  await addCircle("city", { type: "other" });
  await addCircle("council", { type: "circle", parentId: "city" });
  await join("council", 1, 2, 3);
});

describe("who can make a meeting", () => {
  it("shows someone going to an overlapping event as busy, whatever their schedule", async () => {
    await insertEvent(event({ id: "lunch", circleId: "city", organizerId: 2, date: DAY, start: "10:30", end: "11:30", rsvps: [2] }));
    const result = await getMeetingAvailability(1, "council", DAY, "10:00", "11:00");
    expect(result.unavailable).toEqual([{ id: 2, busy: true }]);
    expect(result.unknown.sort()).toEqual([1, 3]);
  });

  it("ignores events that only touch, are on another day, or are the meeting being edited", async () => {
    await insertEvent(event({ id: "before", circleId: "city", organizerId: 2, date: DAY, start: "09:00", end: "10:00", rsvps: [2] }));
    await insertEvent(event({ id: "other-day", circleId: "city", organizerId: 2, date: "2099-01-06", start: "10:00", end: "11:00", rsvps: [2] }));
    await insertEvent(event({ id: "self", circleId: "city", organizerId: 3, date: DAY, start: "10:00", end: "11:00", rsvps: [3] }));
    const result = await getMeetingAvailability(1, "council", DAY, "10:00", "11:00", "self");
    expect(result.unavailable).toEqual([]);
  });

  it("doesn't count a cancelled event", async () => {
    await insertEvent(event({ id: "off", circleId: "city", organizerId: 2, date: DAY, start: "10:00", end: "11:00", rsvps: [2] }));
    await db.update(events).set({ cancelledAt: new Date() }).where(eq(events.id, "off"));
    expect((await getMeetingAvailability(1, "council", DAY, "10:00", "11:00")).unavailable).toEqual([]);
  });
});
