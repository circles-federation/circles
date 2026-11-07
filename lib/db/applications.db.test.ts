import { beforeEach, describe, expect, it } from "vitest";
import { BETA_AGREEMENT_VERSION } from "@/lib/applications.util";
import { addDays, localDay } from "@/lib/recurrence.util";
import { event } from "@/lib/test/factories";
import {
  approveApplication,
  confirmApplication,
  countPendingApplications,
  declineApplication,
  getApplicationPhoto,
  getPendingApplication,
  getPendingApplications,
  renewConfirmationCode,
  setAdmins,
  startApplication,
} from "./applications";
import { insertEvent } from "./events";
import { getMemberPhoto } from "./members";
import { addCircle, addGuestRsvp, addMember, ageApplicationCode, applicationRow, join, loginExists, resetDb, setMemberEmail } from "./testing";
import { db } from "./client";
import { eventGuestRsvps, eventRsvps } from "./schema";

const jpeg = () => new Blob([Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0])], { type: "image/jpeg" });
const input = (over: Partial<{ firstName: string; lastName: string; email: string; neighborhoodId: string }> = {}) => ({
  firstName: "Ona",
  lastName: "Park",
  email: "ona@example.test",
  neighborhoodId: "the903",
  ...over,
});
const apply = (over = {}, version = BETA_AGREEMENT_VERSION) => startApplication(input(over), jpeg(), version);

// a confirmed, pending application
async function pending(over = {}) {
  const { id, code } = await apply(over);
  await confirmApplication(id, code!);
  return id;
}

const ADMIN = 1;

beforeEach(async () => {
  await resetDb();
  await addMember(ADMIN, "Admin");
  await addMember(2);
  await addCircle("city", { type: "other" });
  await addCircle("the903", { type: "neighborhood", parentId: "city", name: "The 903" });
  await addCircle("fox", { type: "neighborhood", parentId: "city", name: "Fox Point" });
  await addCircle("council", { type: "circle", parentId: "the903" });
  await join("the903", ADMIN, 2);
  await setAdmins(["m1@example.test"], true);
});

describe("applying", () => {
  it("stores it unconfirmed with a code, and nothing is reviewable until the code is entered", async () => {
    const { id, code } = await apply();
    expect(code).toMatch(/^\d{6}$/);
    expect((await applicationRow(id))?.status).toBe("unconfirmed");
    expect(await getPendingApplications(ADMIN)).toEqual([]);
    await confirmApplication(id, code!);
    expect((await applicationRow(id))?.status).toBe("pending");
    expect((await getPendingApplications(ADMIN)).map((a) => [a.email, a.neighborhoodName])).toEqual([["ona@example.test", "The 903"]]);
  });

  it("refuses incomplete details, a missing or out-of-date agreement, a bad photo, and anywhere but a neighborhood", async () => {
    await expect(apply({ firstName: "" })).rejects.toBeTruthy();
    await expect(apply({ email: "nope" })).rejects.toBeTruthy();
    await expect(apply({}, "")).rejects.toThrow(/Agree to the beta terms/);
    await expect(apply({}, "1999-01-01")).rejects.toThrow(/terms have changed/);
    await expect(startApplication(input(), new Blob(["not an image at all"]), BETA_AGREEMENT_VERSION)).rejects.toThrow(/isn't a JPEG/);
    await expect(startApplication(input(), new Blob([]), BETA_AGREEMENT_VERSION)).rejects.toBeTruthy();
    await expect(apply({ neighborhoodId: "council" })).rejects.toThrow(/neighborhoods listed/);
  });

  it("refuses a member's address, whatever its case, and one already waiting for review", async () => {
    await expect(apply({ email: "M2@Example.test" })).rejects.toThrow(/already belongs to a member/);
    await pending();
    await expect(apply({ email: "ONA@example.test" })).rejects.toThrow(/already an application/);
  });

  it("replaces an earlier unconfirmed application for the address", async () => {
    const first = await apply();
    const second = await apply({ firstName: "Ona 2" });
    expect(await applicationRow(first.id)).toBeUndefined();
    expect((await applicationRow(second.id))?.status).toBe("unconfirmed");
  });

  it("drops other addresses' unconfirmed applications after a day", async () => {
    const stale = await apply({ email: "stale@example.test" });
    await ageApplicationCode(stale.id, "created-two-days-ago");
    await apply({ email: "new@example.test" });
    expect(await applicationRow(stale.id)).toBeUndefined();
  });
});

describe("confirming the address", () => {
  it("counts wrong codes, locks after five even for the right one, and a new code starts fresh", async () => {
    const { id, code } = await apply();
    for (let i = 0; i < 5; i++) await expect(confirmApplication(id, "not the code")).rejects.toThrow(/doesn't match/);
    expect((await applicationRow(id))?.attempts).toBe(5);
    await expect(confirmApplication(id, code!)).rejects.toThrow(/Too many wrong codes/);
    const fresh = await renewConfirmationCode(id);
    expect((await applicationRow(id))?.attempts).toBe(0);
    await confirmApplication(id, fresh.code);
    expect((await applicationRow(id))?.status).toBe("pending");
  });

  it("refuses an expired code, and one that's already been used", async () => {
    const { id, code } = await apply();
    await ageApplicationCode(id, "expired");
    await expect(confirmApplication(id, code!)).rejects.toThrow(/expired/);
    const fresh = await renewConfirmationCode(id);
    await confirmApplication(id, fresh.code);
    await expect(confirmApplication(id, fresh.code)).rejects.toThrow(/already been confirmed/);
    await expect(renewConfirmationCode(id)).rejects.toThrow(/already been confirmed/);
  });
});

describe("a guest applying from an event they RSVPed to", () => {
  it("goes straight to review with no code, remembering who invited them, and only with the address they RSVPed with", async () => {
    const guest = { email: "ona@example.test", eventId: "party", invitedBy: 2 };
    await insertEvent(event({ id: "party", circleId: "city", organizerId: 2, date: addDays(localDay(), 5) }));
    await expect(startApplication(input({ email: "other@example.test" }), jpeg(), BETA_AGREEMENT_VERSION, guest)).rejects.toThrow(/email address you RSVPed with/);
    const { id, code } = await startApplication(input(), jpeg(), BETA_AGREEMENT_VERSION, guest);
    expect(code).toBeNull();
    expect(await applicationRow(id)).toMatchObject({ status: "pending", referred_by: 2 });
    expect((await getPendingApplication(ADMIN, id))).toMatchObject({ invitedBy: "Member 2" });
  });
});

describe("reviewing is for system admins", () => {
  it("shows everyone else nothing, and refuses them every decision", async () => {
    const id = await pending();
    await expect(getPendingApplications(2)).rejects.toThrow(/system admin/);
    await expect(getPendingApplication(2, id)).rejects.toThrow(/system admin/);
    await expect(approveApplication(2, id)).rejects.toThrow(/system admin/);
    await expect(declineApplication(2, id, "")).rejects.toThrow(/system admin/);
    expect(await getApplicationPhoto(2, id)).toBeNull();
    expect(await countPendingApplications(2)).toBeNull();
    expect(await getApplicationPhoto(ADMIN, id)).toMatchObject({ contentType: "image/jpeg" });
    expect(await countPendingApplications(ADMIN)).toBe(1);
    expect((await applicationRow(id))?.status).toBe("pending");
  });
});

describe("approving", () => {
  it("makes a member of their neighborhood with their photo and a login, and keeps no photo on the application", async () => {
    const id = await pending();
    const decision = await approveApplication(ADMIN, id);
    expect(decision).toEqual({ email: "ona@example.test", firstName: "Ona", neighborhoodName: "The 903" });
    const row = await applicationRow(id);
    expect(row).toMatchObject({ status: "approved", has_photo: false });
    const memberId = row!.member_id!;
    expect(await loginExists("ona@example.test")).toBe(true);
    // a neighbor can see their photo, a stranger can't
    expect(await getMemberPhoto(memberId, memberId)).toMatchObject({ contentType: "image/jpeg" });
    expect(await getMemberPhoto(2, memberId)).not.toBeNull();
    await addMember(9);
    expect(await getMemberPhoto(9, memberId)).toBeNull();
    expect(await countPendingApplications(ADMIN)).toBe(0);
  });

  it("can't be decided twice, nor approved once the address has become a member's", async () => {
    const id = await pending();
    await approveApplication(ADMIN, id);
    await expect(approveApplication(ADMIN, id)).rejects.toThrow(/already been decided/);
    await expect(declineApplication(ADMIN, id, "")).rejects.toThrow(/already been decided/);
    const second = await pending({ email: "pat@example.test" });
    await addMember(7);
    await setMemberEmail(7, "pat@example.test");
    await expect(approveApplication(ADMIN, second)).rejects.toThrow(/already belongs to a member/);
  });

  it("turns a guest's RSVPs into real ones for the city's and their neighborhood's live events, and leaves others", async () => {
    await insertEvent(event({ id: "city-party", circleId: "city", organizerId: 2, date: addDays(localDay(), 5) }));
    await insertEvent(event({ id: "hood-party", circleId: "the903", organizerId: 2, date: addDays(localDay(), 5) }));
    await insertEvent(event({ id: "fox-party", circleId: "fox", organizerId: 2, date: addDays(localDay(), 5) }));
    await insertEvent(event({ id: "old-party", circleId: "city", organizerId: 2, date: addDays(localDay(), -3) }));
    for (const eventId of ["city-party", "hood-party", "fox-party", "old-party"]) await addGuestRsvp(eventId, 2, "ona@example.test");
    const id = await pending();
    await approveApplication(ADMIN, id);
    const memberId = (await applicationRow(id))!.member_id!;
    const rsvps = (await db.select().from(eventRsvps)).filter((r) => r.memberId === memberId).map((r) => r.eventId).sort();
    expect(rsvps).toEqual(["city-party", "hood-party"]);
    const left = await db.select().from(eventGuestRsvps);
    expect(left.map((g) => g.eventId).sort()).toEqual(["fox-party", "old-party"]);
  });
});

describe("declining", () => {
  it("keeps the note and drops the photo, and the address can apply again", async () => {
    const id = await pending();
    const decision = await declineApplication(ADMIN, id, "  Not in the neighborhood  ");
    expect(decision).toMatchObject({ note: "Not in the neighborhood", firstName: "Ona" });
    expect(await applicationRow(id)).toMatchObject({ status: "declined", has_photo: false, note: "Not in the neighborhood" });
    expect(await loginExists("ona@example.test")).toBe(false);
    await expect(apply()).resolves.toBeTruthy();
  });

  it("refuses a note that's too long", async () => {
    const id = await pending();
    await expect(declineApplication(ADMIN, id, "x".repeat(2000))).rejects.toThrow(/Keep the note/);
    expect((await applicationRow(id))?.status).toBe("pending");
  });
});
