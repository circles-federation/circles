import { beforeEach, describe, expect, it } from "vitest";
import { event } from "@/lib/test/factories";
import { getEventsForMember, getVisibleEvent, insertEvent } from "./events";
import { addCircle, addMember, join, resetDb } from "./testing";

/* The privacy boundary for events: getEventsForMember filters in SQL and
   canSee (behind getVisibleEvent) filters one row, and the two must agree. */

const MEMBERS = [1, 2, 3, 4, 5];

beforeEach(async () => {
  await resetDb();
  for (const id of MEMBERS) await addMember(id);
  await addCircle("city", { type: "other" });
  await addCircle("the903", { type: "neighborhood", parentId: "city" });
  await addCircle("council", { type: "circle", parentId: "the903" });
  await addCircle("coop", { type: "cooperative", parentId: "city" });
  await addCircle("club", { type: "group", parentId: "city" });
  await join("the903", 1, 2);
  await join("council", 1);
  await join("coop", 4);
  await join("club", 5);
  const live = { circleId: "city" };
  await insertEvent(event({ id: "city-live", ...live }));
  await insertEvent(event({ id: "903-live", circleId: "the903" }));
  await insertEvent(event({ id: "council-live", circleId: "council" }));
  await insertEvent(event({ id: "club-live", circleId: "club" }));
  await insertEvent(event({ id: "903-by-council", circleId: "the903", hostCircleId: "council" }));
  await insertEvent(event({ id: "903-by-council-proposed", circleId: "the903", hostCircleId: "council", proposed: true }));
  await insertEvent(event({ id: "council-meeting-proposed", circleId: "council", kind: "meeting", proposed: true }));
  await insertEvent(event({ id: "903-proposed", circleId: "the903", proposed: true }));
  await insertEvent(event({ id: "coop-by-council", circleId: "coop", hostCircleId: "council" }));
});

const idsFor = async (memberId: number) => (await getEventsForMember(memberId)).map((e) => e.id).sort();

describe("who sees which event", () => {
  it("shows a member their circles' events, the city's, and ones their circle hosts", async () => {
    expect(await idsFor(1)).toEqual(
      ["903-by-council", "903-by-council-proposed", "903-live", "903-proposed", "city-live", "coop-by-council", "council-live", "council-meeting-proposed"].sort()
    );
  });

  it("shows a neighbor only their own circle's, plus the city's, never a sub-circle's", async () => {
    expect(await idsFor(2)).toEqual(["903-by-council", "903-live", "903-proposed", "city-live"]);
  });

  it("shows someone in no circle only the city's events", async () => {
    expect(await idsFor(3)).toEqual(["city-live"]);
  });

  it("shows a co-op member what the council hosts for them, once it's decided", async () => {
    expect(await idsFor(4)).toEqual(["city-live", "coop-by-council"]);
  });

  it("keeps a group's events to the group", async () => {
    expect(await idsFor(5)).toEqual(["city-live", "club-live"]);
    for (const id of [1, 2, 3, 4]) expect(await idsFor(id)).not.toContain("club-live");
  });

  it("shows an undecided proposal only to the circle deciding it", async () => {
    // the host circle decides a hosted one: the neighborhood it's shown to doesn't see it
    expect(await idsFor(2)).not.toContain("903-by-council-proposed");
    expect(await idsFor(1)).toContain("903-by-council-proposed");
    // a meeting is decided by its own circle
    expect(await idsFor(2)).not.toContain("council-meeting-proposed");
  });

  it("agrees with the single-event check for every member and event", async () => {
    const all = (await Promise.all(MEMBERS.map(idsFor))).flat();
    const everyId = [...new Set(all)];
    for (const memberId of MEMBERS) {
      const listed = new Set(await idsFor(memberId));
      for (const id of everyId) {
        const seen = (await getVisibleEvent(memberId, id)) !== null;
        expect(seen, `member ${memberId}, event ${id}`).toBe(listed.has(id));
      }
    }
  });

  it("treats an event that doesn't exist as one they can't see", async () => {
    expect(await getVisibleEvent(1, "nope")).toBeNull();
  });
});
