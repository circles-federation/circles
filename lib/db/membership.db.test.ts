import { beforeEach, describe, expect, it } from "vitest";
import { getCircleById, getCirclesForMember, leaveCircle } from "./circles";
import { addCircle, addMember, join, resetDb, roleHolder, seatIn, setRoles } from "./testing";

const DELEGATE = "Delegate";

beforeEach(async () => {
  await resetDb();
  for (const id of [1, 2, 3, 4]) await addMember(id);
  await addCircle("city", { type: "other" });
  await addCircle("the903", { type: "neighborhood", parentId: "city", name: "The 903" });
  await join("the903", 1, 2, 3);
  // a Circle that has grown, with two circles inside it
  await addCircle("parent", { type: "circle", parentId: "the903", name: "Parent" });
  await join("parent", 1, 2);
  await addCircle("childA", { type: "circle", parentId: "parent", name: "Child A" });
  await join("childA", 3, 4);
  await addCircle("childB", { type: "circle", parentId: "parent", name: "Child B" });
  await join("childB", 3, 4);
  await addCircle("club", { type: "group", parentId: "city" });
  await join("club", 1);
});

const memberIdsOf = async (circleId: string) => ((await getCircleById(circleId))?.members ?? []).sort();

describe("leaving a circle", () => {
  it("removes the membership and empties the roles they held there", async () => {
    await setRoles("parent", [{ label: "Secretary", memberId: 2 }]);
    expect(await roleHolder("parent", "Secretary")).toBe(2);
    expect(await leaveCircle(2, "parent")).toEqual({ archived: false });
    expect(await memberIdsOf("parent")).toEqual([1]);
    expect(await roleHolder("parent", "Secretary")).toBeNull();
  });

  it("refuses a non-member, a neighborhood, and a circle that doesn't exist", async () => {
    await expect(leaveCircle(3, "parent")).rejects.toThrow(/not a member/);
    await expect(leaveCircle(1, "the903")).rejects.toThrow(/can't be left/);
    await expect(leaveCircle(1, "nope")).rejects.toThrow(/doesn't exist/);
    expect(await memberIdsOf("the903")).toEqual([1, 2, 3]);
  });

  it("archives the circle when its last member goes, hiding it from everyone", async () => {
    await leaveCircle(1, "parent");
    expect(await leaveCircle(2, "parent")).toEqual({ archived: true });
    expect((await getCirclesForMember(3)).map((c) => c.id)).not.toContain("parent");
    expect((await getCirclesForMember(2)).map((c) => c.id)).not.toContain("parent");
    await expect(leaveCircle(1, "parent")).rejects.toThrow(/doesn't exist/);
  });

  it("keeps a group out of sight of anyone who isn't in it", async () => {
    expect((await getCirclesForMember(1)).map((c) => c.id)).toContain("club");
    expect((await getCirclesForMember(2)).map((c) => c.id)).not.toContain("club");
    await leaveCircle(1, "club");
    expect((await getCirclesForMember(1)).map((c) => c.id)).not.toContain("club");
  });
});

describe("a circle's delegate", () => {
  it("sits in the circle above as a full member, marked as there for their circle", async () => {
    await setRoles("childA", [{ label: DELEGATE, memberId: 3 }]);
    expect(await seatIn("parent", 3)).toBe("childA");
    expect(await memberIdsOf("parent")).toEqual([1, 2, 3]);
  });

  it("goes again when the role is given up, taking what they held there", async () => {
    await setRoles("childA", [{ label: DELEGATE, memberId: 3 }]);
    await setRoles("parent", [{ label: "Secretary", memberId: 2 }]);
    await setRoles("childA", [{ label: DELEGATE, memberId: 4 }]);
    expect(await seatIn("parent", 3)).toBeUndefined();
    expect(await seatIn("parent", 4)).toBe("childA");
  });

  it("empties the roles a departing delegate held in the circle above", async () => {
    await setRoles("childA", [{ label: DELEGATE, memberId: 3 }]);
    // the delegate is a member of parent now, so can be given a role there
    await setRoles("parent", [{ label: "Leader", memberId: 3 }]);
    expect(await roleHolder("parent", "Leader")).toBe(3);
    await setRoles("childA", []);
    expect(await seatIn("parent", 3)).toBeUndefined();
    expect(await roleHolder("parent", "Leader")).toBeNull();
  });

  it("leaves a member who was already there in their own right in place", async () => {
    await join("childA", 1);
    await setRoles("childA", [{ label: DELEGATE, memberId: 1 }]);
    expect(await seatIn("parent", 1)).toBeNull();
    await setRoles("childA", []);
    expect(await seatIn("parent", 1)).toBeNull();
  });

  it("keeps one person's seat while they speak for any of the circles", async () => {
    await setRoles("childA", [{ label: DELEGATE, memberId: 3 }]);
    await setRoles("childB", [{ label: DELEGATE, memberId: 3 }]);
    await setRoles("childA", []);
    expect(await seatIn("parent", 3)).toBe("childB");
    await setRoles("childB", []);
    expect(await seatIn("parent", 3)).toBeUndefined();
  });

  it("can't leave the circle above while holding the role", async () => {
    await setRoles("childA", [{ label: DELEGATE, memberId: 3 }]);
    await expect(leaveCircle(3, "parent")).rejects.toThrow(/Child A's delegate to Parent/);
    await setRoles("childA", []);
    await expect(leaveCircle(3, "parent")).rejects.toThrow(/not a member/);
  });

  it("loses their seat when the circle they speak for is archived", async () => {
    await setRoles("childA", [{ label: DELEGATE, memberId: 3 }]);
    await leaveCircle(4, "childA");
    // the last member out archives it, and an archived circle sends no one up
    await leaveCircle(3, "childA");
    expect(await seatIn("parent", 3)).toBeUndefined();
  });

  it("is only for a Circle accountable to its parent: a collective can't name one", async () => {
    await addCircle("collective", { type: "collective", parentId: "parent" });
    await join("collective", 3);
    await setRoles("collective", [{ label: DELEGATE, memberId: 3 }]);
    expect(await seatIn("parent", 3)).toBeUndefined();
  });
});
