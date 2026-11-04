import { describe, expect, it } from "vitest";
import { awaitingConsent, canManageEvent, isApproved, isCircleHosted, isEventOrganizer, isGoverned, isMeeting, isProposal, isScheduledMeeting, kindOf, majority } from "./governance.util";
import { indexCircles } from "./circles.util";
import { circle, event } from "./test/factories";
import type { Member } from "./types";

const member = (id: number) => ({ id }) as Member;
const byId = indexCircles([circle({ id: "host", members: [2] }), circle({ id: "shown", members: [3] })]);

describe("event kinds", () => {
  it("defaults to an ordinary event", () => {
    expect(kindOf(event()).label).toBe("Event");
    expect(kindOf(event({ kind: "meeting" })).label).toBe("Meeting");
  });
  it("only a meeting is governed by kind", () => {
    expect(kindOf(event()).governance).toBe(false);
    expect(kindOf(event({ kind: "meeting" })).governance).toBe(true);
  });
});

describe("what's governed and what's decided", () => {
  const plain = event();
  const meeting = event({ kind: "meeting" });
  const hosted = event({ hostCircleId: "host" });
  it("a meeting or a circle-hosted event is governed; a plain one isn't", () => {
    expect(isGoverned(plain)).toBe(false);
    expect(isGoverned(meeting)).toBe(true);
    expect(isGoverned(hosted)).toBe(true);
    expect(isMeeting(meeting)).toBe(true);
    expect(isCircleHosted(hosted)).toBe(true);
    expect(isCircleHosted(plain)).toBe(false);
  });
  it("approved means governed and decided", () => {
    expect(isApproved(plain)).toBe(false);
    expect(isApproved(meeting)).toBe(true);
    expect(isApproved({ ...hosted, proposed: true })).toBe(false);
  });
  it("a role-holder's meeting is scheduled outright", () => {
    expect(isScheduledMeeting(event({ kind: "meeting", approvedByRole: "Leader" }))).toBe(true);
    expect(isScheduledMeeting(meeting)).toBe(false);
    expect(isScheduledMeeting(event({ approvedByRole: "Leader" }))).toBe(false);
  });
  it("a cancelled proposal is no longer awaiting consent", () => {
    expect(isProposal({ ...hosted, proposed: true })).toBe(true);
    expect(awaitingConsent({ ...hosted, proposed: true })).toBe(true);
    expect(awaitingConsent({ ...hosted, proposed: true, cancelled: true })).toBe(false);
    expect(awaitingConsent(hosted)).toBe(false);
  });
});

describe("majority", () => {
  it("is more than half", () => {
    expect([1, 2, 3, 4, 5, 6].map(majority)).toEqual([1, 2, 2, 3, 3, 4]);
  });
});

describe("who manages an event", () => {
  it("the organizer", () => {
    const e = event({ organizerId: 1 });
    expect(isEventOrganizer(e, member(1))).toBe(true);
    expect(isEventOrganizer(e, member(2))).toBe(false);
    expect(isEventOrganizer(e, null)).toBe(false);
    expect(canManageEvent(e, member(1), byId)).toBe(true);
  });
  it("a person's event is theirs alone, even if it's shown to a circle they're in", () => {
    const e = event({ organizerId: 1, circleId: "shown" });
    expect(canManageEvent(e, member(3), byId)).toBe(false);
  });
  it("any member of the host circle manages a circle-hosted event", () => {
    const e = event({ organizerId: 1, hostCircleId: "host", circleId: "shown" });
    expect(canManageEvent(e, member(2), byId)).toBe(true);
    expect(canManageEvent(e, member(3), byId)).toBe(false);
  });
  it("any member of a meeting's circle manages it", () => {
    const e = event({ organizerId: 1, kind: "meeting", circleId: "shown" });
    expect(canManageEvent(e, member(3), byId)).toBe(true);
    expect(canManageEvent(e, member(2), byId)).toBe(false);
  });
  it("no one, when signed out or the circle is unknown", () => {
    expect(canManageEvent(event({ hostCircleId: "host" }), null, byId)).toBe(false);
    expect(canManageEvent(event({ hostCircleId: "gone" }), member(2), byId)).toBe(false);
  });
});
